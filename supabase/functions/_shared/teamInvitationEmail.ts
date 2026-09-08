export type TeamInvitationEmailInput = {
  origin: string;
  token: string;
  to: string;
  invitationId?: string;
  teamName: string;
  artistName: string;
  operatingTitle: string | null;
  responsibilityTags: string[];
  expiresAt: string;
};

export function buildTeamInvitationEmail(input: TeamInvitationEmailInput) {
  const origin = input.origin.replace(/\/$/, "");
  const joinUrl = `${origin}/join#token=${encodeURIComponent(input.token)}`;
  const title = input.operatingTitle?.trim();
  const tags = input.responsibilityTags.map((tag) => tag.trim()).filter(Boolean);
  const roleContext = [title, ...tags].filter(Boolean).join(" · ");
  const expiresOn = formatDate(input.expiresAt);
  const subject = `Join ${input.teamName} on Desk`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>Join ${escapeHtml(input.teamName)}</h1><p>For ${escapeHtml(input.artistName)}</p>${roleContext ? `<p>${escapeHtml(roleContext)}</p>` : ""}<p><a href="${escapeHtml(joinUrl)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#7c3aed;color:#fff;text-decoration:none">Join team</a></p><p style="color:#5b606b">This link expires on ${escapeHtml(expiresOn)}.</p><p style="color:#5b606b">If the button does not open, copy this link:</p><p>${escapeHtml(joinUrl)}</p></div>`;
  return {
    to: input.to,
    subject,
    html,
    metadata: {
      ...(input.invitationId ? { invitation_id: input.invitationId } : {}),
      template: "team_invitation",
      expires_at: input.expiresAt,
    },
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date);
}
