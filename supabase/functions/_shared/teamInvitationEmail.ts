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
  const tags = input.responsibilityTags.filter((tag) => tag.trim()).join(", ");
  const expiresOn = formatDate(input.expiresAt);
  const subject = `You’re invited to ${input.teamName}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>You’re invited to ${escapeHtml(input.teamName)}</h1><p>You’ve been invited to work with ${escapeHtml(input.artistName)} in the shared OrderSounds workspace.</p>${title ? `<p><strong>Operating title:</strong> ${escapeHtml(title)}</p>` : ""}${tags ? `<p><strong>Responsibilities:</strong> ${escapeHtml(tags)}</p>` : ""}<p>This invitation expires on ${escapeHtml(expiresOn)}.</p><p><a href="${escapeHtml(joinUrl)}">Accept invitation</a></p><p>If the button does not open, copy this link into your browser:</p><p>${escapeHtml(joinUrl)}</p></div>`;
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
