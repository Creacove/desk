import { cn } from "../lib/utils";

export type WorkspaceIdentityProps = {
  teamName?: string | null;
  artistName: string;
  isTeamPlan: boolean;
  countLabel?: string;
  variant?: "shell" | "page";
  className?: string;
};

/** The three identities stay explicit: account/team, managed artist, signed-in person. */
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
  const loadingTeam = isTeamPlan && !cleanTeamName;
  const primary = loadingTeam ? "Team workspace" : isTeamPlan ? cleanTeamName : cleanArtistName;
  const secondary = loadingTeam
    ? "Loading team identity"
    : isTeamPlan
      ? `${cleanArtistName} · ${variant === "page" ? "artist workspace" : "Artist"}`
      : "Artist desk";
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
        <p className={cn(
          "truncate font-medium text-muted-foreground",
          variant === "page" ? "mt-1 text-[13px]" : "mt-0.5 text-[11px] uppercase tracking-[0.07em] text-muted-foreground/68",
        )}>
          {secondary}
        </p>
      </div>
      {countLabel ? <p className="shrink-0 text-[13px] font-semibold text-brand-accent">{countLabel}</p> : null}
    </div>
  );
}
