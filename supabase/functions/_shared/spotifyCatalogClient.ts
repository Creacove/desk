import type {
  SpotifyAlbumPayload,
  SpotifyArtistAlbumsResponse,
  SpotifyArtistPayload,
  SpotifyAudioFeaturesPayload,
  SpotifyCatalogClient,
} from "./spotifyCatalogBootstrap.ts";

const spotifyTimeoutMs = 15000;

/**
 * Builds a Spotify Web API client using the Client Credentials flow. Shared by
 * the setup catalog bootstrap and the catalogue import functions so all Spotify
 * access uses identical auth, timeouts, and error shaping.
 */
export async function createSpotifyCatalogClient(): Promise<SpotifyCatalogClient> {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const token = await postSpotifyToken(credentials);

  const callSpotify = async <T>(path: string, params: Record<string, string | number | undefined> = {}) => {
    const url = new URL(`https://api.spotify.com/v1${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return fetchSpotifyJson<T>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  return {
    getArtist: (artistId: string) => callSpotify<SpotifyArtistPayload>(`/artists/${encodeURIComponent(artistId)}`),
    getArtistAlbums: (
      artistId: string,
      options: { market?: string; limit: number; includeGroup: "album" | "single"; offset?: number },
    ) =>
      callSpotify<SpotifyArtistAlbumsResponse>(`/artists/${encodeURIComponent(artistId)}/albums`, {
        include_groups: options.includeGroup,
        market: options.market,
        limit: options.limit,
        offset: options.offset,
      }),
    getAlbum: (albumId: string, options: { market?: string }) =>
      callSpotify<SpotifyAlbumPayload>(`/albums/${encodeURIComponent(albumId)}`, { market: options.market }),
    getTrackAudioFeatures: (trackId: string) =>
      callSpotify<SpotifyAudioFeaturesPayload>(`/audio-features/${encodeURIComponent(trackId)}`),
  };
}

async function postSpotifyToken(credentials: string) {
  const response = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed with ${response.status}.`);
  }

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }

  return token.access_token;
}

async function fetchSpotifyJson<T>(url: string, init: RequestInit) {
  const response = await fetchWithTimeout(url, init);

  if (!response.ok) {
    throw new Error(`Spotify ${new URL(url).pathname} failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), spotifyTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Spotify request timed out after ${spotifyTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
