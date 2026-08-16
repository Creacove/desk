import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sendTransactionalEmail } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ShareInput = {
  action: "create" | "list" | "send" | "revoke";
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicSubject?: { type: "music_item" | "music_project"; id: string };
  assetIds?: string[];
  documentIds?: string[];
  informationKeys?: string[];
  preset?: "listen" | "epk_press" | "delivery" | "custom";
  recipientEmail?: string;
  label?: string;
  url?: string;
  shareLinkId?: string;
};

Deno.serve(withAppErrorCapture("music-share-links", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const input = await request.json() as ShareInput;
    validateInput(input);
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const authClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);
    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", { target_account_id: input.accountId });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);

    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await assertWorkspace(db, input);
    if (input.action === "create") return json(await createShareLink(db, input, user.id));
    if (input.action === "list") return json(await listShareLinks(db, input));
    if (input.action === "send") return json(await sendShareEmail(db, input));
    return json(await revokeShareLink(db, input));
  } catch (error) {
    return json({ error: safeError(error) }, 400);
  }
}));

async function createShareLink(db: any, input: ShareInput, userId: string) {
  const subject = requireSubject(input);
  const assetIds = uniqueIds(input.assetIds);
  const documentIds = uniqueIds(input.documentIds);
  const informationKeys = allowedInformationKeys(input.informationKeys);
  if (!assetIds.length && !documentIds.length && !informationKeys.length) throw new Error("Select at least one file, document, or song detail to share.");
  const target = subject.type === "music_item"
    ? { table: "music_items", foreignKey: "music_item_id" }
    : { table: "music_projects", foreignKey: "music_project_id" };
  const [{ data: music, error: musicError }, { data: assets, error: assetsError }, { data: profile, error: profileError }] = await Promise.all([
    owned(db.from(target.table).select("id,title,metadata,released_at,lifecycle_stage"), input).eq("id", subject.id).maybeSingle(),
    assetIds.length
      ? owned(db.from("music_assets").select("id,title,asset_type,status,uploaded_file_id"), input).eq(target.foreignKey, subject.id).in("id", assetIds).limit(40)
      : Promise.resolve({ data: [], error: null }),
    owned(db.from("artist_profiles").select("display_name"), input).maybeSingle(),
  ]);
  if (musicError) throw musicError;
  if (assetsError) throw assetsError;
  if (profileError) throw profileError;
  if (!music?.id) throw new Error("Music record was not found.");
  if ((assets ?? []).length !== assetIds.length) throw new Error("One or more selected files do not belong to this music record.");
  const fileIds = (assets ?? []).map((asset: any) => asset.uploaded_file_id).filter((id: unknown): id is string => typeof id === "string");
  if (fileIds.length !== assetIds.length) throw new Error("Every selected asset must have an uploaded file.");
  const { data: files, error: filesError } = await owned(
    db.from("uploaded_files").select("id,file_name,file_type,storage_bucket,storage_ref,status"),
    input,
  ).in("id", fileIds).in("status", ["uploaded", "processed"]).limit(40);
  if (filesError) throw filesError;
  if ((files ?? []).length !== fileIds.length) throw new Error("A selected file is still processing or unavailable.");
  const filesById = new Map<string, any>((files ?? []).map((file: any) => [file.id, file]));
  const manifest = (assets ?? []).map((asset: any) => {
    const file = filesById.get(asset.uploaded_file_id);
    if (!file) throw new Error("A selected file could not be prepared for sharing.");
    return {
      assetId: asset.id,
      title: cleanText(asset.title, 180),
      assetType: cleanText(asset.asset_type, 80),
      fileName: cleanText(file.file_name, 240),
      fileType: cleanText(file.file_type, 120),
      bucket: cleanText(file.storage_bucket, 120),
      path: cleanText(file.storage_ref, 600),
    };
  });
  const documentFields = subject.type === "music_item" && documentIds.length
    ? await loadDocumentFields(db, input, subject.id, documentIds)
    : [];
  const metadata = music?.metadata && typeof music.metadata === "object" ? music.metadata : {};
  const detailFields = informationKeys.flatMap((key) => {
    const value = canonicalInformationValue(key, music, metadata);
    return value ? [{ key, title: informationTitle(key), value }] : [];
  });
  const identity = {
    title: cleanText(music.title, 180),
    artist: canonicalInformationValue("primary_artist", music, metadata) || cleanText(profile?.display_name, 180),
  };
  const informationManifest = { version: 2, identity, fields: [...detailFields, ...documentFields] };
  const rawToken = randomToken();
  const { data: shareLink, error: insertError } = await db.from("music_share_links").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    ...(subject.type === "music_item" ? { music_item_id: subject.id } : { music_project_id: subject.id }),
    label: cleanText(input.label, 180) || `${music.title} ${presetEmailLabel(validPreset(input.preset))}`,
    access_mode: "link",
    recipient_email: normalizeEmail(input.recipientEmail) || null,
    preset: validPreset(input.preset),
    asset_manifest: manifest,
    information_manifest: informationManifest,
    token_hash: await hashToken(rawToken),
    state: "active",
    created_by_id: userId,
  }).select("id,label,preset,recipient_email,created_at").single();
  if (insertError) throw insertError;
  const url = publicUrl(rawToken);
  await writeEvent(db, input, "music_share_link_created", `Prepared a share link for ${music.title}.`, subject, {
    shareLinkId: shareLink.id,
    preset: shareLink.preset,
    assetCount: manifest.length,
    informationCount: informationManifest.fields.length,
    recipientEmail: shareLink.recipient_email ?? "",
  });
  return { shareLink: { id: shareLink.id, label: shareLink.label, preset: shareLink.preset, url, recipientEmail: shareLink.recipient_email ?? "", createdAt: shareLink.created_at } };
}

async function loadDocumentFields(db: any, input: ShareInput, musicItemId: string, documentIds: string[]) {
  const { data: links, error: linksError } = await owned(db.from("artifact_links").select("source_id,target_id"), input)
    .eq("source_type", "document").eq("target_type", "music_item").eq("target_id", musicItemId).in("source_id", documentIds).limit(40);
  if (linksError) throw linksError;
  const linkedIds = [...new Set((links ?? []).map((link: any) => link.source_id).filter((id: unknown): id is string => typeof id === "string"))];
  if (linkedIds.length !== documentIds.length) throw new Error("One or more selected documents do not belong to this song.");
  const { data: documents, error: documentsError } = await owned(db.from("documents").select("id,title,document_type,current_version_id,status,origin"), input).in("id", linkedIds).limit(40);
  if (documentsError) throw documentsError;
  if ((documents ?? []).length !== linkedIds.length) throw new Error("One or more selected documents are unavailable.");
  for (const document of documents ?? []) {
    const internalNarrative = document.document_type === "release_narrative"
      || cleanText(document.title, 180).toLowerCase() === "release narrative";
    if (internalNarrative) throw new Error("The internal Release Narrative cannot be shared.");
  }
  const { data: versions, error: versionsError } = await owned(db.from("document_versions").select("id,document_id,metadata"), input).in("document_id", linkedIds).limit(80);
  if (versionsError) throw versionsError;
  return (documents ?? []).flatMap((document: any) => {
    const version = (versions ?? []).find((item: any) => item.id === document.current_version_id)
      ?? (versions ?? []).find((item: any) => item.document_id === document.id);
    const body = cleanLongText(version?.metadata?.body, 60_000);
    if (!body) return [];
    return [{ key: `document:${document.id}`, title: cleanText(document.title, 180), value: body, documentType: cleanText(document.document_type, 80) }];
  });
}

function allowedInformationKeys(value: unknown) {
  const allowed = new Set(["song_title", "primary_artist", "release_date", "label", "copyright", "genre"]);
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.has(item)))];
}

function canonicalInformationValue(key: string, music: any, metadata: any) {
  const manualDetails = metadata?.manual_details && typeof metadata.manual_details === "object" ? metadata.manual_details : {};
  if (key === "song_title") return cleanText(music?.title, 500);
  if (key === "release_date") return cleanText(manualDetails?.release_date ?? manualDetails?.planned_release_date ?? metadata?.release_date ?? music?.released_at, 500);
  if (key === "primary_artist") return cleanText(manualDetails?.primary_artist ?? manualDetails?.primary_artists ?? metadata?.artists?.[0]?.name ?? metadata?.primary_artist, 500);
  if (key === "label") return cleanText(manualDetails?.record_label ?? manualDetails?.label ?? metadata?.label ?? metadata?.album_label, 500);
  if (key === "copyright") return cleanText(Array.isArray(metadata?.copyrights) ? metadata.copyrights.join("; ") : metadata?.copyright, 2_000);
  if (key === "genre") return cleanText(manualDetails?.genre ?? (Array.isArray(metadata?.genres) ? metadata.genres.join(", ") : metadata?.genre), 500);
  return "";
}

function informationTitle(key: string) {
  return ({ song_title: "Song title", primary_artist: "Primary artist", release_date: "Release date", label: "Record label", copyright: "Copyright", genre: "Genre" } as Record<string, string>)[key] ?? key;
}

function cleanLongText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
}

async function listShareLinks(db: any, input: ShareInput) {
  const subject = requireSubject(input);
  const subjectColumn = subject.type === "music_item" ? "music_item_id" : "music_project_id";
  const { data, error } = await owned(
    db.from("music_share_links").select("id,label,preset,state,recipient_email,created_at,access_count,asset_manifest"),
    input,
  )
    .eq(subjectColumn, subject.id)
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw error;
  return {
    shareLinks: (data ?? []).map((shareLink: any) => ({
      id: shareLink.id,
      label: cleanText(shareLink.label, 180) || "Shared release package",
      preset: validPreset(shareLink.preset),
      state: ["active", "revoked", "expired"].includes(shareLink.state) ? shareLink.state : "expired",
      recipientEmail: normalizeEmail(shareLink.recipient_email) || "",
      createdAt: typeof shareLink.created_at === "string" ? shareLink.created_at : "",
      assetCount: Array.isArray(shareLink.asset_manifest) ? shareLink.asset_manifest.length : 0,
      accessCount: Math.max(0, Math.floor(Number(shareLink.access_count) || 0)),
    })),
  };
}

async function sendShareEmail(db: any, input: ShareInput) {
  const shareLinkId = requiredText(input.shareLinkId, "Share link id", 120);
  const { data: shareLink, error } = await owned(
    db.from("music_share_links").select("id,label,preset,recipient_email,state,expires_at,music_item_id,music_project_id,token_hash,information_manifest"),
    input,
  ).eq("id", shareLinkId).maybeSingle();
  if (error) throw error;
  if (!shareLink?.id || shareLink.state !== "active") throw new Error("This share link is no longer active.");
  if (shareLink.expires_at && new Date(shareLink.expires_at).getTime() <= Date.now()) throw new Error("This share link has expired.");
  const recipient = normalizeEmail(input.recipientEmail) || normalizeEmail(shareLink.recipient_email);
  if (!recipient) throw new Error("Enter a recipient email before sending this package.");
  if (!shareLink.recipient_email) {
    const { error: recipientError } = await db.from("music_share_links").update({ recipient_email: recipient }).eq("id", shareLink.id);
    if (recipientError) throw recipientError;
  }
  // A capability token is intentionally never persisted. Validate the caller-held
  // token against its stored hash before delivering it, so this endpoint cannot be
  // used as a general-purpose email relay for arbitrary URLs.
  const rawToken = tokenFromPublicUrl(requiredText(input.url, "Share URL", 2_000));
  if (await hashToken(rawToken) !== shareLink.token_hash) {
    throw new Error("Share URL does not match this package.");
  }
  const url = publicUrl(rawToken);
  const identity = shareLink.information_manifest?.identity ?? {};
  const packageTitle = cleanText(identity?.title, 180) || cleanText(shareLink.label, 180);
  const packageArtist = cleanText(identity?.artist, 180);
  await sendTransactionalEmail({
    db,
    eventKey: `music-share-link:${shareLink.id}:${recipient}`,
    template: "music_share_link",
    to: recipient,
    subject: `${packageTitle}${packageArtist ? ` by ${packageArtist}` : ""} — ${presetEmailLabel(shareLink.preset)}`,
    html: `<div style="margin:0 auto;max-width:560px;padding:40px 24px;font-family:Arial,sans-serif;color:#17191f"><p style="margin:0 0 10px;font-size:12px;color:#717680">ORDERSOUNDS · PRIVATE SHARE</p><h1 style="margin:0;font-size:28px;line-height:1.15">${escapeHtml(packageTitle)}</h1>${packageArtist ? `<p style="margin:8px 0 0;color:#717680">${escapeHtml(packageArtist)}</p>` : ""}<p style="margin:28px 0 24px;color:#4f545d;line-height:1.6">A ${escapeHtml(presetEmailLabel(shareLink.preset))} has been shared with you.</p><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:10px;background:#17191f;color:#fff;padding:13px 20px;text-decoration:none;font-weight:700">Open package</a><p style="margin:28px 0 0;font-size:11px;line-height:1.5;color:#8a8f98">If the button does not open, paste this link into your browser:<br>${escapeHtml(url)}</p></div>`,
    metadata: { share_link_id: shareLink.id },
  });
  const subject = shareLink.music_item_id
    ? { type: "music_item" as const, id: shareLink.music_item_id }
    : { type: "music_project" as const, id: shareLink.music_project_id };
  await writeEvent(db, input, "music_share_link_sent", `Sent a share link to ${recipient}.`, subject, { shareLinkId: shareLink.id, recipientEmail: recipient });
  return { status: "sent", shareLinkId: shareLink.id, recipientEmail: recipient };
}

async function revokeShareLink(db: any, input: ShareInput) {
  const shareLinkId = requiredText(input.shareLinkId, "Share link id", 120);
  const { data, error } = await owned(db.from("music_share_links").select("id,music_item_id,music_project_id"), input).eq("id", shareLinkId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Share link was not found.");
  const { error: updateError } = await db.from("music_share_links").update({ state: "revoked" }).eq("id", data.id);
  if (updateError) throw updateError;
  const subject = data.music_item_id ? { type: "music_item" as const, id: data.music_item_id } : { type: "music_project" as const, id: data.music_project_id };
  await writeEvent(db, input, "music_share_link_revoked", "Revoked a shared release package.", subject, { shareLinkId: data.id });
  return { status: "revoked", shareLinkId: data.id };
}

async function assertWorkspace(db: any, input: ShareInput) {
  const { data, error } = await db.from("artist_workspaces").select("id").eq("id", input.artistWorkspaceId).eq("account_id", input.accountId).eq("artist_id", input.artistId).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Artist workspace was not found.");
}

async function writeEvent(db: any, input: ShareInput, eventType: string, summary: string, subject: { type: "music_item" | "music_project"; id: string }, payload: Record<string, unknown>) {
  const { error } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: eventType,
    actor_type: "user",
    target_type: subject.type,
    target_id: subject.id,
    display_mode: "activity",
    refresh_scope: ["music-list", "activity"],
    summary,
    payload,
  });
  if (error) throw error;
}

function presetEmailLabel(value: unknown) {
  if (value === "listen") return "private listen";
  if (value === "epk_press") return "press / media kit";
  if (value === "delivery") return "distributor delivery";
  return "private package";
}

function owned(query: any, input: ShareInput) {
  return query.eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId);
}

function requireSubject(input: ShareInput) {
  const subject = input.musicSubject;
  if (!subject?.id || (subject.type !== "music_item" && subject.type !== "music_project")) throw new Error("Choose a song or project to share.");
  return subject;
}

function validateInput(input: ShareInput) {
  if (!input || !["create", "list", "send", "revoke"].includes(input.action)) throw new Error("Share action is invalid.");
  for (const [key, value] of Object.entries({ accountId: input.accountId, artistWorkspaceId: input.artistWorkspaceId, artistId: input.artistId })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${key}.`);
  }
}

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{16,}$/i.test(item)).slice(0, 40))];
}

function validPreset(value: unknown): "listen" | "epk_press" | "delivery" | "custom" {
  return value === "listen" || value === "epk_press" || value === "delivery" ? value : "custom";
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = cleanText(value, maxLength);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicUrl(token: string) {
  const origin = Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("APP_ORIGIN") ?? "https://app.ordersounds.com";
  return `${origin.replace(/\/$/, "")}/share?token=${encodeURIComponent(token)}`;
}

function tokenFromPublicUrl(value: string) {
  const expected = new URL(publicUrl("placeholder"));
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Share URL is invalid.");
  }
  if (parsed.origin !== expected.origin || parsed.pathname !== expected.pathname) {
    throw new Error("Share URL does not match this package.");
  }
  const token = parsed.searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(token)) throw new Error("Share URL is invalid.");
  return token.toLowerCase();
}

function safeError(error: unknown) {
  return error instanceof Error && error.message ? error.message.slice(0, 500) : "Share link could not be completed.";
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
