export const config = { runtime: "edge" } as const;

type RequestLike = {
  headers?: Headers | Record<string, string | string[] | undefined>;
};

function readCountryHeader(request: RequestLike) {
  const headers = request.headers;
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("x-vercel-ip-country") ?? undefined;
  }
  const value = (headers as Record<string, string | string[] | undefined>)["x-vercel-ip-country"];
  return Array.isArray(value) ? value[0] : value;
}

export default function handler(request: RequestLike) {
  const candidate = readCountryHeader(request);
  const normalized = typeof candidate === "string" ? candidate.trim().toUpperCase() : undefined;
  const countryCode = normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;

  return new Response(JSON.stringify(countryCode ? { countryCode } : {}), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
    },
  });
}
