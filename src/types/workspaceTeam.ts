export type WorkspaceScope = { accountId: string; artistWorkspaceId: string; artistId: string };
export type WorkspaceMember = {
  userId: string;
  displayName: string;
  accessRole: "owner" | "member";
  operatingTitle: string | null;
  responsibilityTags: string[];
};
export type WorkspaceRoster = { scope: WorkspaceScope; members: WorkspaceMember[]; loadedAt: string };
export type WorkspaceTeamCapability = WorkspaceScope & {
  planKey: "solo" | "team_6";
  enabled: boolean;
  entitled: boolean;
  source: "subscription" | "pilot" | "none";
  seatLimit: 1 | 6;
  occupiedSeats: number;
  reservedSeats: number;
  endsAt: string | null;
  firstRunCompletedAt?: string | null;
};
export type TeamInvitation = {
  id: string;
  artistWorkspaceId: string;
  email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  operatingTitle: string | null;
  responsibilityTags: string[];
};
export type TeamResponsibilities = { operatingTitle: string | null; responsibilityTags: string[] };
export type TeamInvitationPreview = {
  teamName: string;
  artistName: string;
  operatingTitle: string | null;
  responsibilityTags: string[];
  expiresAt: string;
};
export type TeamInvitationDeliveryStatus = "sent" | "failed" | "skipped";
export type TeamInvitationMutation = {
  invitation: TeamInvitation;
  token: string;
  emailStatus?: TeamInvitationDeliveryStatus;
};
export type TeamFirstRunInput = WorkspaceScope & {
  teamName: string;
  operatingTitle: string | null;
  responsibilityTags: string[];
};
