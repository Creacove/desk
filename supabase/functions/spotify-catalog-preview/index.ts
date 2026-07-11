import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSpotifyCatalogClient } from "../_shared/spotifyCatalogClient.ts";
import { loadSpotifyCatalogPreview } from "../_shared/spotifyCatalogPreview.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PreviewInput = {
  selectedArtist?: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    imageUrl?: string;
  };
  market?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const authClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized." }, 401);

    const input = (await request.json()) as PreviewInput;
    const selectedArtist = input.selectedArtist;
    if (!selectedArtist?.spotifyArtistId) return json({ error: "Selected artist is required." }, 400);

    try {
      return json(await loadSpotifyCatalogPreview({
        artistId: selectedArtist.spotifyArtistId,
        market: input.market ?? "US",
        spotify: await createSpotifyCatalogClient(),
      }));
    } catch {
      return json({
        artist: {
          spotifyArtistId: selectedArtist.spotifyArtistId,
          name: selectedArtist.name,
          spotifyUrl: selectedArtist.spotifyUrl,
          imageUrl: selectedArtist.imageUrl,
        },
        standaloneSingles: [],
      });
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Spotify catalog preview failed." }, 500);
  }
});

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
