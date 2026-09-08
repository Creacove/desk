import { cn } from "../lib/utils";

export type WorkspaceIdentityProps = {
  teamName?: string | null;
  artistName: string;
  isTeamPlan: boolean;
  countLabel?: string;
  variant?: "shell" | "page";
  className?: string;
};

/** Keep the persistent shell identity short; settings can carry the full workspace context. */
export function WorkspaceIdentity({
  teamName,
  artistName,
  isTeamPlan,
  countLabel,
  variant = "shell",
  className,
}: WorkspaceIdentityProps) {
  const cleanTeamName = teamName?.trim();
  const cleanArtistName = artistName.trim() || "Artist desk";
  const primary = variant === "page"
    ? (isTeamPlan ? cleanTeamName || "Team workspace" : cleanArtistName)
    : `${cleanArtistName}'s Desk`;
  const Primary = variant === "page" ? "h2" : "p";

  return (
    <div className={cn("min-w-0", variant === "page" && "flex min-w-0 flex-wrap items-end justify-between gap-3", className)} data-testid={`workspace-identity-${variant}`}>
      <div className="min-w-0">
        <Primary className={cn(
          "truncate font-display font-semibold tracking-[-0.025em] text-foreground",
          variant === "page" ? "text-[26px]" : "text-[14px]",
        )}>
          {primary}
        </Primary>
        {variant === "page" ? (
          <p className="mt-1 truncate text-[13px] font-medium text-muted-foreground">
            {isTeamPlan ? cleanArtistName : "Artist desk"}
          </p>
        ) : isTeamPlan && cleanTeamName ? (
          <p
            data-testid="workspace-team-badge"
            className="mt-1 inline-flex max-w-full truncate rounded-md border border-brand-accent/20 bg-brand-accent/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-accent"
          >
            {cleanTeamName}
          </p>
        ) : null}
      </div>
      {countLabel ? <p className="shrink-0 text-[13px] font-semibold text-brand-accent">{countLabel}</p> : null}
    </div>
  );
}
