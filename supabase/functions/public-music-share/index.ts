import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(withAppErrorCapture("public-music-share", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as { token?: unknown };
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!/^[0-9a-f]{64}$/i.test(token)) return json({ error: "This share link is invalid or unavailable." }, 404);
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const tokenHash = await hashToken(token);
    const { data: shareLink, error } = await db.from("music_share_links")
      .select("id,label,preset,asset_manifest,information_manifest,state,created_at,expires_at")
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
      const [{ data: inlineData, error: inlineError }, { data: downloadData, error: downloadError }] = await Promise.all([
        db.storage.from(bucket).createSignedUrl(path, 300),
        db.storage.from(bucket).createSignedUrl(path, 300, { download: cleanText(asset?.fileName, 240) || undefined }),
      ]);
      if (inlineError || downloadError || !inlineData?.signedUrl || !downloadData?.signedUrl) return null;
      return {
        id: cleanText(asset?.assetId, 120),
        title: cleanText(asset?.title, 180) || "Shared file",
        assetType: cleanText(asset?.assetType, 80),
        fileName: cleanText(asset?.fileName, 240) || "download",
        fileType: cleanText(asset?.fileType, 120),
        inlineUrl: inlineData.signedUrl,
        downloadUrl: downloadData.signedUrl,
      };
    }));
    const availableAssets = assets.filter(Boolean);
    const { information, documents } = normalizeInformationManifest(shareLink.information_manifest);
    const identity = normalizeIdentity(shareLink.information_manifest);
    if (!availableAssets.length && !information.length && !documents.length) return json({ error: "This share link is unavailable." }, 404);

    const { error: accessError } = await db.rpc("record_music_share_link_access", { target_share_link_id: shareLink.id });
    if (accessError) throw accessError;
    return json({
      label: cleanText(shareLink.label, 180),
      preset: cleanText(shareLink.preset, 40),
      title: identity.title,
      artist: identity.artist,
      createdAt: shareLink.created_at,
      expiresAt: shareLink.expires_at,
      assets: availableAssets,
      information,
      documents,
    });
  } catch {
    return json({ error: "This share link is unavailable." }, 404);
  }
}));

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

function normalizeInformationManifest(value: unknown) {
  const manifest = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const fields = Array.isArray(manifest.fields) ? manifest.fields.slice(0, 60) : [];
  const information: Array<{ key: string; title: string; value: string }> = [];
  const documents: Array<{ id: string; title: string; documentType: string; body: string }> = [];

  for (const field of fields as any[]) {
    const key = cleanText(field?.key, 180);
    const title = cleanText(field?.title, 180);
    const content = cleanLongText(field?.value, 60_000);
    const documentType = cleanText(field?.documentType, 80);
    if (!key || !title || !content) continue;
    if (documentType || key.startsWith("document:")) {
      const body = recipientSafeDocumentBody(content);
      const safeTitle = publicDocumentTitle(title);
      if (!body || !safeTitle) continue;
      documents.push({ id: key.replace(/^document:/, ""), title: safeTitle, documentType: documentType || "document", body });
      continue;
    }
    information.push({ key, title, value: content });
  }
  return { information, documents };
}

function recipientSafeDocumentBody(rawBody: string) {
  const lines = rawBody.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let suppressInternalSection = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+(needs verification|internal gaps)\s*$/i.test(line)) {
      suppressInternalSection = true;
      continue;
    }
    if (suppressInternalSection && /^##\s+/.test(line)) suppressInternalSection = false;
    if (suppressInternalSection) continue;
    if (/^\*\*(purpose|audience|core narrative):\*\*/i.test(line)) continue;
    if (/^>\s*internal campaign strategy/i.test(line)) continue;
    kept.push(rawLine);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 60_000);
}

function publicDocumentTitle(value: string) {
  return value
    .replace(/\s*[—-]\s*(?:updated\s+)?draft\s*$/i, "")
    .replace(/\s*\((?:updated\s+)?draft\)\s*$/i, "")
    .replace(/\s*\[(?:updated\s+)?draft\]\s*$/i, "")
    .trim();
}

function normalizeIdentity(value: unknown) {
  const manifest = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const identity = manifest.identity && typeof manifest.identity === "object" ? manifest.identity : {};
  return { title: cleanText(identity.title, 180), artist: cleanText(identity.artist, 180) };
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
