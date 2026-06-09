export type ChartmetricRateLimit = {
  limit?: string;
  remaining?: string;
  reset?: string;
};

export type ChartmetricClientOptions = {
  refreshToken: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
};

export type ChartmetricJsonResponse<T> = {
  data: T;
  rateLimit: ChartmetricRateLimit;
};

export type ChartmetricClient = {
  requestJson<T>(path: string, init?: RequestInit): Promise<ChartmetricJsonResponse<T>>;
};

type AccessTokenState = {
  token: string;
  expiresAt: number;
};

const DEFAULT_CHARTMETRIC_BASE_URL = "https://api.chartmetric.com";
const TOKEN_REFRESH_SAFETY_MS = 60_000;

export function createChartmetricClient(options: ChartmetricClientOptions): ChartmetricClient {
  const refreshToken = options.refreshToken.trim();
  if (!refreshToken) {
    throw new Error("Chartmetric refresh token is not configured.");
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_CHARTMETRIC_BASE_URL);
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let accessToken: AccessTokenState | null = null;

  async function getAccessToken() {
    if (accessToken && accessToken.expiresAt - TOKEN_REFRESH_SAFETY_MS > now()) {
      return accessToken.token;
    }

    const response = await fetchImpl(`${baseUrl}/api/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshtoken: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Chartmetric token exchange failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as { token?: string; expires_in?: number };
    if (!payload.token) {
      throw new Error("Chartmetric token exchange did not return an access token.");
    }

    const expiresInMs = Number.isFinite(payload.expires_in) ? Number(payload.expires_in) * 1000 : 3_600_000;
    accessToken = {
      token: payload.token,
      expiresAt: now() + expiresInMs,
    };

    return accessToken.token;
  }

  return {
    async requestJson<T>(path: string, init: RequestInit = {}) {
      const request = async (token: string) =>
        fetchImpl(`${baseUrl}${normalizePath(path)}`, {
          ...init,
          method: init.method ?? "GET",
          headers: {
            ...headersToRecord(init.headers),
            Authorization: `Bearer ${token}`,
          },
        });

      let response = await request(await getAccessToken());
      if (response.status === 401) {
        accessToken = null;
        response = await request(await getAccessToken());
      }

      if (!response.ok) {
        throw new Error(`Chartmetric request failed with status ${response.status}.`);
      }

      return {
        data: (await response.json()) as T,
        rateLimit: readRateLimit(response.headers),
      };
    },
  };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  return Object.fromEntries(new Headers(headers).entries());
}

function readRateLimit(headers: Headers): ChartmetricRateLimit {
  return {
    limit: headers.get("X-RateLimit-Limit") ?? undefined,
    remaining: headers.get("X-RateLimit-Remaining") ?? undefined,
    reset: headers.get("X-RateLimit-Reset") ?? undefined,
  };
}
