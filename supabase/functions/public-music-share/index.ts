import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[0-9a-f]{64}$/i.test(token)) return json({ error: "This share link is invalid or unavailable." }, 404);
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const tokenHash = await hashToken(token);
    const { data: shareLink, error } = await db.from("music_share_links")
      .select("id,label,preset,asset_manifest,information_manifest,state,expires_at")
      .eq("token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    if (!shareLink || shareLink.state !== "active") return json({ error: "This share link is invalid or unavailable." }, 404);
    if (shareLink.expires_at && new Date(shareLink.expires_at).getTime() <= Date.now()) {
      await db.from("music_share_links").update({ state: "expired" }).eq("id", shareLink.id);
      return json({ error: "This share link has expired." }, 410);
    }
    const manifest = Array.isArray(shareLink.asset_manifest) ? shareLink.asset_manifest.slice(0, 40) : [];
    const assets = await Promise.all(manifest.map(async (asset: any) => {
      const bucket = cleanText(asset?.bucket, 120);
      const path = cleanText(asset?.path, 600);
      if (!bucket || !path) return null;
      const { data, error: signedUrlError } = await db.storage.from(bucket).createSignedUrl(path, 300, { download: cleanText(asset?.fileName, 240) || undefined });
      if (signedUrlError || !data?.signedUrl) return null;
      return {
        id: cleanText(asset?.assetId, 120),
        title: cleanText(asset?.title, 180) || "Shared file",
        assetType: cleanText(asset?.assetType, 80),
        fileName: cleanText(asset?.fileName, 240) || "download",
        fileType: cleanText(asset?.fileType, 120),
        downloadUrl: data.signedUrl,
      };
    }));
    const availableAssets = assets.filter(Boolean);
    const information = normalizeInformationManifest(shareLink.information_manifest);
    if (!availableAssets.length && !information.length) return json({ error: "This share link is unavailable." }, 404);
    const { error: accessError } = await db.rpc("record_music_share_link_access", { target_share_link_id: shareLink.id });
    if (accessError) throw accessError;
    return json({ label: cleanText(shareLink.label, 180), preset: cleanText(shareLink.preset, 40), assets: availableAssets, information });
  } catch (error) {
    return json({ error: "This share link is unavailable." }, 404);
  }
});

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeInformationManifest(value: unknown) {
  const manifest = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fields = Array.isArray(manifest.fields) ? manifest.fields.slice(0, 60) : [];
  return fields.flatMap((field: any) => {
    const key = cleanText(field?.key, 180);
    const title = cleanText(field?.title, 180);
    const content = String(field?.value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, 60_000);
    return key && title && content ? [{ key, title, value: content, documentType: cleanText(field?.documentType, 80) }] : [];
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
