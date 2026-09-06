import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { handleAccountTeamRequest } from "../_shared/accountTeamHandler.ts";
import { buildTeamInvitationEmail } from "../_shared/teamInvitationEmail.ts";
import { sendTransactionalEmail } from "../_shared/transactionalEmail.ts";

// This endpoint deliberately never captures raw request bodies: join tokens are credentials.
Deno.serve(withAppErrorCapture("account-team", async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return new Response(JSON.stringify({ error: "Team service is unavailable." }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const db = createClient(url, service);
  return handleAccountTeamRequest(request, {
    allowedOrigins: [Deno.env.get("APP_ORIGIN"), Deno.env.get("PUBLIC_APP_URL"), Deno.env.get("LOCAL_APP_ORIGIN")].filter((value): value is string => Boolean(value)),
    authenticate: async (authorization) => {
      const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
      const { data, error } = await auth.auth.getUser();
      return error ? null : data.user;
    },
    rpc: (name, args) => db.rpc(name, args),
    token: async () => {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    },
    hash: async (token) => {
      const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    sendInvitationEmail: async ({ invitation, token }) => {
      const row = invitation && typeof invitation === "object" ? invitation as Record<string, unknown> : {};
      const invitationId = typeof row.id === "string" ? row.id : "";
      const to = typeof row.email === "string" ? row.email : "";
      if (!invitationId || !to) throw new Error("Invitation email recipient is unavailable.");
      const tokenHash = await (async () => {
        const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      })();
      const { data: preview, error: previewError } = await db.rpc("preview_account_invitation_v1", { p_token_hash: tokenHash });
      if (previewError || !preview || typeof preview !== "object") throw previewError ?? new Error("Invitation preview is unavailable.");
      const previewRow = preview as Record<string, unknown>;
      const teamName = typeof previewRow.teamName === "string" ? previewRow.teamName : "the team";
      const artistName = typeof previewRow.artistName === "string" ? previewRow.artistName : "the artist";
      const operatingTitle = typeof previewRow.operatingTitle === "string" ? previewRow.operatingTitle : null;
      const responsibilityTags = Array.isArray(previewRow.responsibilityTags)
        ? previewRow.responsibilityTags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const expiresAt = typeof previewRow.expiresAt === "string" ? previewRow.expiresAt : "";
      if (!expiresAt) throw new Error("Invitation expiry is unavailable.");
      const message = buildTeamInvitationEmail({
        origin: Deno.env.get("APP_ORIGIN") ?? Deno.env.get("PUBLIC_APP_URL") ?? Deno.env.get("LOCAL_APP_ORIGIN") ?? "",
        token,
        to,
        invitationId,
        teamName,
        artistName,
        operatingTitle,
        responsibilityTags,
        expiresAt,
      });
      await sendTransactionalEmail({
        db,
        eventKey: `team-invitation:${invitationId}:${expiresAt}`,
        template: "team_invitation",
        to: message.to,
        subject: message.subject,
        html: message.html,
        metadata: message.metadata,
      });
    },
  });
}));
