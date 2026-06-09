import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SearchInput = {
  query: string;
};

type SpotifyImage = {
  url: string;
  width?: number | null;
  height?: number | null;
};

type SpotifyArtist = {
  id: string;
  name: string;
  uri?: string;
  external_urls?: { spotify?: string };
  followers?: { total?: number };
  genres?: string[];
  images?: SpotifyImage[];
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const input = (await request.json()) as SearchInput;
    const query = input.query?.trim();
    if (!query) {
      return json({ artists: [] });
    }

    const accessToken = await createSpotifyAccessToken();
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("type", "artist");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", "5");

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      return json({ error: `Spotify artist search failed with ${searchResponse.status}.` }, 502);
    }

    const payload = (await searchResponse.json()) as { artists?: { items?: SpotifyArtist[] } };
    return json({
      artists: (payload.artists?.items ?? []).map(toCandidate),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Spotify artist search failed." }, 500);
  }
});

async function createSpotifyAccessToken() {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Spotify token request failed with ${tokenResponse.status}.`);
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }

  return token.access_token;
}

function toCandidate(artist: SpotifyArtist) {
  return {
    spotifyArtistId: artist.id,
    name: artist.name,
    spotifyUrl: artist.external_urls?.spotify ?? `https://open.spotify.com/artist/${artist.id}`,
    spotifyUri: artist.uri,
    followers: artist.followers?.total ?? 0,
    genres: artist.genres ?? [],
    imageUrl: selectImage(artist.images),
  };
}

function selectImage(images: SpotifyImage[] | undefined) {
  return [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
