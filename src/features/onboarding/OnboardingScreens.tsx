import { ArrowLeft, ArrowRight, Check, Loader2, LogOut, Search } from "lucide-react";
import { BrandMark } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";
import type { ProductionSpotifyArtistCandidate } from "../../types/productionApp";

export function ConnectArtistScreen({
  profile,
  query = "",
  candidates = [],
  pending = false,
  message,
  onQueryChange,
  onSelectCandidate,
  onContinue,
  onSignOut,
}: {
  profile?: ArtistProfileViewModel;
  query?: string;
  candidates?: ProductionSpotifyArtistCandidate[];
  pending?: boolean;
  message?: string | null;
  onQueryChange?: (query: string) => void;
  onSelectCandidate?: (candidate: ProductionSpotifyArtistCandidate) => void;
  onContinue?: () => void;
  onSignOut?: () => void;
}) {
  const searchMode = Boolean(onQueryChange && onSelectCandidate);

  return (
    <main className="app-light relative z-10 mx-auto min-h-screen w-full max-w-[1500px] px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <ConnectHeader status={searchMode ? "Connect artist" : "Connect"} onSignOut={onSignOut} />
      <section className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-8 text-center">
        <div className="w-full rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
          <p className="font-ui text-[9px] font-bold uppercase tracking-[0.16em] text-brand-accent">Artist Setup</p>
          <h1 className="font-display mt-3 text-[24px] font-bold leading-tight tracking-tight text-foreground">Connect artist profile</h1>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground">
            {searchMode
              ? "Search Spotify, choose the correct artist identity, and import public catalog context before Desk HQ opens."
              : "Confirm the baseline profile to populate the Manager and specialist context."}
          </p>

          {searchMode ? (
            <div className="mt-6 flex flex-col items-stretch text-left">
              <label htmlFor="spotify-artist-search">
                <span className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/78">Step 1 / Identity</span>
                <span className="relative mt-2 block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
                  <input
                    id="spotify-artist-search"
                    aria-label="Search Spotify artist"
                    value={query}
                    onChange={(event) => onQueryChange?.(event.target.value)}
                    placeholder="Type an artist name"
                    className="h-11 w-full rounded-[12px] border border-foreground/8 bg-background p-3 pl-10 text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/5"
                  />
                </span>
              </label>
              {message ? (
                <p className="mt-3 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-3 text-[12px] font-bold text-muted-foreground">
                  {message}
                </p>
              ) : null}
              <div className="mt-4 grid gap-2.5">
                {pending ? (
                  <div className="flex items-center gap-3 rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-3.5">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <p className="text-[13px] font-bold">Searching Spotify</p>
                  </div>
                ) : null}
                {!pending && candidates.length
                  ? candidates.map((candidate) => (
                      <button
                        key={candidate.spotifyArtistId}
                        type="button"
                        className="group flex w-full items-center justify-between gap-3 rounded-[16px] border border-foreground/5 bg-foreground/[0.025] p-3.5 text-left shadow-inner transition-all hover:border-brand-accent/20 hover:bg-foreground/[0.04]"
                        aria-label={`Select Spotify artist ${candidate.name}`}
                        onClick={() => onSelectCandidate?.(candidate)}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          {candidate.imageUrl ? (
                            <img className="h-11 w-11 shrink-0 rounded-[12px] object-cover" src={candidate.imageUrl} alt={`${candidate.name} artist image`} />
                          ) : (
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#1db954]/10 text-[#1db954]">
                              <BrandMark size="sm" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-bold text-foreground">{candidate.name}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                              {candidate.followers ? `${candidate.followers.toLocaleString()} followers` : "Spotify public artist"}
                              {candidate.genres.length ? ` / ${candidate.genres.slice(0, 2).join(", ")}` : ""}
                            </span>
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </button>
                    ))
                  : null}
              </div>
            </div>
          ) : profile ? (
            <>
              <div className="mt-6 flex flex-col items-stretch text-left">
                <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/78">Verified Artist Identity</p>
                <div className="mt-2 flex items-center justify-between rounded-[16px] border border-foreground/5 bg-foreground/[0.025] p-3.5 shadow-inner">
                  <div className="flex min-w-0 items-center gap-3">
                    <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} />
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-bold text-foreground">{profile.name}</h3>
                      <p className="mt-0.5 text-[11px] font-semibold text-[#1db954]">Spotify Verified Catalog</p>
                    </div>
                  </div>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1db954]/10 text-[#1db954]">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onContinue}
                className="group mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-foreground text-[13px] font-bold text-background shadow-md transition-all hover:bg-foreground/90 active:scale-[0.98]"
              >
                Continue to artist context
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export function SetupScreen({
  profile,
  onChange,
  onBack,
  onContinue,
  pending = false,
  catalogSyncStatus,
  onSignOut,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onBack: () => void;
  onContinue: (profile: ArtistProfileViewModel) => void | Promise<void>;
  pending?: boolean;
  catalogSyncStatus?: "queued" | "running" | "needs_context" | "completed" | "completed_with_limits" | "failed" | "cancelled";
  onSignOut?: () => void;
}) {
  const update = (key: keyof ArtistProfileViewModel, value: string) => onChange({ ...profile, [key]: value });
  const complete = hasRequiredContext(profile);
  const catalogMessage = getCatalogStatusMessage(catalogSyncStatus);

  return (
    <main className="app-light relative z-10 mx-auto min-h-screen w-full max-w-[1500px] px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <ConnectHeader status="Setup" onSignOut={onSignOut} />
      <section className="mx-auto max-w-5xl px-4 py-6">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/50 px-3.5 py-1.5 text-[12px] font-bold text-muted-foreground transition-all hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          Back to profile
        </button>

        <div className="mt-5 grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
          <div className="lg:sticky lg:top-12">
            <p className="font-ui text-[11px] font-bold uppercase tracking-[0.18em] text-brand-accent">Artist Context</p>
            <h1 className="font-display mt-4 text-[30px] font-bold leading-tight tracking-tight text-foreground lg:text-[34px]">Manager Basics</h1>
            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-foreground/80">
              Provide baseline context to target release strategy and department constraints.
            </p>

            <div className="mt-6 rounded-[18px] border border-foreground/8 bg-foreground/[0.02] p-5">
              <div className="flex items-center gap-3">
                <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} />
                <div className="min-w-0">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Spotify artist</p>
                  <p className="mt-1 truncate text-[13px] font-bold text-foreground">{profile.name}</p>
                </div>
              </div>
              <p className="mt-4 font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Onboarding tips</p>
              <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-foreground/90">
                Accurate stages, goals, and social handles prevent specialists from guessing.
              </p>
            </div>
          </div>

          <div className="rounded-[20px] border border-foreground/8 bg-background/50 p-5 shadow-xl backdrop-blur-xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupInput label="Artist name" value={profile.name} onChange={(value) => update("name", value)} />
              <SetupInput label="Spotify identity" value={profile.spotify} onChange={(value) => update("spotify", value)} active />
              <SetupInput label="Artist stage" value={profile.stage} onChange={(value) => update("stage", value)} />
              <SetupInput label="Home market" value={profile.market} onChange={(value) => update("market", value)} />
              <SetupInput label="Genre" value={profile.genre} onChange={(value) => update("genre", value)} />
              <ArtistDirectionField value={profile.goal} onChange={(value) => update("goal", value)} />
              <SetupInput label="Active release" value={profile.release} onChange={(value) => update("release", value)} />
              <SetupInput label="Monthly budget" value={profile.budget} onChange={(value) => update("budget", value)} />
              <SetupInput label="TikTok" value={profile.tiktok} onChange={(value) => update("tiktok", value)} />
              <SetupInput label="Instagram" value={profile.instagram} onChange={(value) => update("instagram", value)} />
              <SetupInput label="YouTube" value={profile.youtube} onChange={(value) => update("youtube", value)} />
              <SetupInput label="X" value={profile.x} onChange={(value) => update("x", value)} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/5 pt-4">
              <div className="max-w-md">
                <p className="text-[12px] font-bold text-[#c2410c] opacity-80">Private stats remain locked until handles are connected.</p>
                {catalogMessage ? <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground">{catalogMessage}</p> : null}
                {!complete ? (
                  <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground">
                    {hasRequiredContext(profile)
                      ? "Desk HQ can open while Spotify catalog import continues in the background."
                      : "Complete artist stage, home market, genre, artist direction, and monthly budget to enter Desk HQ."}
                  </p>
                ) : null}
              </div>

              <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => onContinue(profile)}
                  disabled={!complete || pending}
                  className="inline-flex h-10 items-center justify-center rounded-[10px] border border-foreground/10 bg-background px-6 text-[12px] font-bold text-foreground transition-all hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => onContinue(profile)}
                  disabled={!complete || pending}
                  className="group inline-flex h-10 items-center justify-center gap-2 rounded-[10px] bg-foreground px-6 text-[12px] font-bold text-background shadow-sm transition-all hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  Enter Desk HQ
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ArtistAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  return imageUrl ? (
    <img className="h-11 w-11 shrink-0 rounded-[12px] object-cover" src={imageUrl} alt={`${name} artist image`} />
  ) : (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#1db954]/10 text-[#1db954]">
      <BrandMark size="sm" />
    </span>
  );
}

function ConnectHeader({ status, onSignOut }: { status: string; onSignOut?: () => void }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-left">
        <BrandMark size="sm" />
        <div>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/74">Ordersounds</p>
          <h1 className="font-display text-2xl font-bold leading-none tracking-tight">Desk</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 bg-background px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground transition-colors duration-200">
          {status}
        </span>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-foreground/10 bg-background px-2.5 font-ui text-[11px] font-bold text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03] hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}

function SetupInput({
  label,
  value,
  onChange,
  active = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  active?: boolean;
}) {
  const id = `setup-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div
      className={cn(
        "group rounded-[12px] border bg-background p-2.5 transition-all duration-300",
        active ? "border-brand-accent ring-2 ring-brand-accent/5" : "border-foreground/8 focus-within:border-brand-accent/50 focus-within:ring-2 focus-within:ring-brand-accent/5",
      )}
    >
      <label htmlFor={id} className="font-ui block text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/85 transition-colors group-focus-within:text-brand-accent">
        {label}
      </label>
      <input
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-transparent text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function ArtistDirectionField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="group rounded-[12px] border border-brand-accent/15 bg-brand-accent/[0.025] p-3 transition-all duration-300 focus-within:border-brand-accent/45 focus-within:ring-2 focus-within:ring-brand-accent/5 sm:col-span-2">
      <label htmlFor="artist-direction" className="font-ui block text-[9px] font-bold uppercase tracking-[0.12em] text-brand-accent">
        Artist Direction
      </label>
      <p className="mt-1 text-[11px] font-semibold leading-relaxed text-muted-foreground/90">
        Specify target positioning, goals, team boundaries, or budget constraints for this release.
      </p>
      <textarea
        id="artist-direction"
        aria-label="Artist Direction"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[70px] w-full resize-none rounded-[10px] border border-foreground/8 bg-background/75 p-3 text-[13px] font-semibold leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/85"
      />
    </div>
  );
}

function hasRequiredContext(profile: ArtistProfileViewModel) {
  return Boolean(profile.stage.trim() && profile.market.trim() && profile.genre.trim() && profile.goal.trim() && profile.budget.trim());
}

function getCatalogStatusMessage(status: "queued" | "running" | "needs_context" | "completed" | "completed_with_limits" | "failed" | "cancelled" | undefined) {
  if (status === "queued" || status === "running") {
    return "Spotify catalog import is running in the background.";
  }

  if (status === "failed" || status === "cancelled") {
    return "Spotify catalog import failed. Desk HQ can still open, but Music catalog context will be limited until the import is retried.";
  }

  if (status === "completed_with_limits") {
    return "Spotify catalog import completed with public catalog limits.";
  }

  return null;
}
