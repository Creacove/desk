import { ArrowLeft, ArrowRight, Check, CreditCard, Lock, LogOut, Search } from "lucide-react";
import { BrandMark } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";
import type { ProductionBillingCheckoutPreview, ProductionSpotifyArtistCandidate } from "../../types/productionApp";

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
    <main className="app-theme relative min-h-screen overflow-hidden bg-background px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(17,19,24,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,24,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative z-10 mx-auto w-full max-w-[1500px]">
        <ConnectHeader status={searchMode ? "Connect artist" : "Connect"} onSignOut={onSignOut} />
        <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-6 py-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(22rem,0.72fr)]">
          <div className="max-w-xl">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Artist Authentication</p>
            <h1 className="font-display mt-4 text-[38px] font-semibold leading-[1] tracking-tight text-foreground sm:text-[46px]">
              Bring your catalog to life.
            </h1>
            <p className="mt-5 max-w-[32rem] text-[15px] font-semibold leading-relaxed text-foreground/72">
              Connect your official artist profile to sync your releases, stream catalog data, and build your AI-powered operating desk.
            </p>
          </div>

          <div className="w-full rounded-[18px] border border-foreground/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] backdrop-blur-xl sm:p-6">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">
              <span className="sr-only">Spotify identity</span>
              Artist identity
            </p>
            <h2 className="font-display mt-3 text-[24px] font-bold leading-tight tracking-tight text-foreground">Connect artist profile</h2>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground">
              {searchMode
                ? "Search for your profile, choose the correct artist identity, and import public catalog context before Desk HQ opens."
                : "Confirm the baseline profile to populate the Manager and specialist context."}
            </p>

            {searchMode ? (
              <div className="mt-6 flex flex-col items-stretch text-left">
                <label htmlFor="spotify-artist-search">
                  <span className="relative mt-2 block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
                    <input
                      id="spotify-artist-search"
                      aria-label="Search Spotify artist"
                      value={query}
                      onChange={(event) => onQueryChange?.(event.target.value)}
                      placeholder="Type an artist name"
                      className="h-11 w-full rounded-[10px] border border-foreground/10 bg-background p-3 pl-10 text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/5"
                    />
                  </span>
                </label>
                {message ? (
                  <p className="mt-3 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-3 text-[12px] font-bold text-muted-foreground">
                    {message}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2.5">
                  {pending ? (
                    <div data-testid="spotify-search-loader" className="flex items-center gap-3 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-3.5">
                      <BrandMark size="sm" className="ordersounds-loader-logo" />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-foreground">Searching catalog</span>
                        <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">Matching artist identity and public catalog source.</span>
                      </span>
                    </div>
                  ) : null}
                  {!pending && candidates.length
                    ? candidates.map((candidate) => (
                        <button
                          key={candidate.spotifyArtistId}
                          type="button"
                          className="group flex w-full items-center justify-between gap-3 rounded-[14px] border border-foreground/5 bg-foreground/[0.025] p-3.5 text-left shadow-inner transition-all hover:border-brand-accent/20 hover:bg-foreground/[0.04]"
                          aria-label={`Select Spotify artist ${candidate.name}`}
                          onClick={() => onSelectCandidate?.(candidate)}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {candidate.imageUrl ? (
                              <img className="h-11 w-11 shrink-0 rounded-[10px] object-cover" src={candidate.imageUrl} alt={`${candidate.name} artist image`} />
                            ) : (
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#1db954]/10 text-[#1db954]">
                                <BrandMark size="sm" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-bold text-foreground">{candidate.name}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                                {candidate.followers ? `${candidate.followers.toLocaleString()} followers` : "Public artist"}
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
                  <div className="mt-2 flex items-center justify-between rounded-[14px] border border-foreground/5 bg-foreground/[0.025] p-3.5 shadow-inner">
                    <div className="flex min-w-0 items-center gap-3">
                      <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} />
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-bold text-foreground">{profile.name}</h3>
                        <p className="mt-0.5 text-[11px] font-semibold text-[#1db954]">Verified Catalog</p>
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
                  className="group mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground text-[13px] font-bold text-background shadow-md transition-all hover:bg-foreground/90 active:scale-[0.98]"
                >
                  Continue to artist context
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>
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
  discoverySteps?: string[];
}) {
  const update = (key: keyof ArtistProfileViewModel, value: string) => onChange({ ...profile, [key]: value });
  const complete = hasRequiredContext(profile);
  const catalogMessage = getCatalogStatusMessage(catalogSyncStatus);

  return (
    <main className="app-theme relative min-h-screen overflow-hidden bg-background px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <div className="pointer-events-none absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(17,19,24,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,24,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative z-10 mx-auto w-full max-w-[1500px]">
        <ConnectHeader status="Setup" onSignOut={onSignOut} />
        <section className="mx-auto max-w-6xl px-0 py-6">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 rounded-[10px] border border-foreground/10 bg-white/76 px-3.5 py-2 text-[12px] font-bold text-muted-foreground shadow-sm transition-all hover:bg-foreground/5 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          Back to profile
        </button>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="lg:sticky lg:top-12">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Artist Context</p>
            <h1 className="font-display mt-4 text-[38px] font-semibold leading-[1] tracking-tight text-foreground lg:text-[46px]">Manager Basics</h1>
            <p className="mt-5 max-w-[28rem] text-[15px] font-semibold leading-relaxed text-foreground/72">
              Give the Manager enough operational context to target release strategy, team constraints, and source limits.
            </p>

            <div className="mt-6 rounded-[16px] border border-foreground/8 bg-white/72 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} />
                <div className="min-w-0">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-[#16883f]">Spotify artist</p>
                  <p className="mt-1 truncate text-[13px] font-bold text-foreground">{profile.name}</p>
                </div>
              </div>
              <p className="mt-4 font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Onboarding tips</p>
              <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-foreground/90">
                Catalog, market, and stage reads come from enrichment. Add only the human constraints the sources cannot know.
              </p>
            </div>
          </div>

          <div className="rounded-[18px] border border-foreground/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] backdrop-blur-xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupInput label="Artist name" value={profile.name} onChange={(value) => update("name", value)} />
              <SetupInput label="Spotify identity" value={profile.spotify} onChange={(value) => update("spotify", value)} active />
              <ArtistDirectionField value={profile.goal} onChange={(value) => update("goal", value)} />
              <SetupInput label="Monthly budget" value={profile.budget} onChange={(value) => update("budget", value)} />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/5 pt-4">
              <div className="max-w-md">
                <p className="text-[12px] font-bold text-[#c2410c] opacity-80">The desk will infer stage, market, genre, and current catalog shape from enrichment.</p>
                {catalogMessage ? <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground">{catalogMessage}</p> : null}
                {!complete ? (
                  <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground">
                    {hasRequiredContext(profile)
                      ? "Desk HQ can open while Spotify catalog import continues in the background."
                      : "Add artist direction and monthly budget to enter Desk HQ."}
                  </p>
                ) : null}
                {pending ? (
                  <div data-testid="setup-save-loader" className="mt-3 flex items-center gap-3 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-3">
                    <BrandMark size="sm" className="ordersounds-loader-logo" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-foreground">Preparing Desk HQ</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-muted-foreground">Saving Manager basics and checking source readiness.</span>
                    </span>
                  </div>
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
                  {pending ? "Preparing Desk HQ" : "Enter Desk HQ"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}

export function PaywallPreviewScreen({
  preview,
  pending = false,
  error,
  onSubscribe,
  onBack,
  onSignOut,
}: {
  preview: ProductionBillingCheckoutPreview;
  pending?: boolean;
  error?: string | null;
  onSubscribe: () => void | Promise<void>;
  onBack: () => void;
  onSignOut?: () => void;
}) {
  const artist = preview.artist;
  const genreLine = artist.genres.slice(0, 2).join(" / ");
  const price = formatPaywallPrice(preview);

  return (
    <main className="app-theme relative h-screen overflow-hidden bg-background px-4 py-3 text-foreground dark:bg-[#0d0f13] sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(17,19,24,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,24,0.04)_1px,transparent_1px)] [background-size:44px_44px] dark:opacity-[0.16] dark:[background-image:linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)]" />
      <div className="relative z-10 mx-auto flex h-[calc(100vh-1.5rem)] w-full max-w-[1320px] flex-col">
        <ConnectHeader status="Subscription" onSignOut={onSignOut} />

        <button
          type="button"
          onClick={onBack}
          className="mt-3 inline-flex w-fit items-center gap-2 rounded-[10px] border border-foreground/10 bg-white/76 px-3 py-1.5 text-[12px] font-bold text-muted-foreground shadow-sm transition-all hover:bg-foreground/5 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/8"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to artist search
        </button>

        <section className="relative mt-3 grid min-h-0 flex-1 overflow-hidden rounded-[14px] border border-foreground/10 bg-white/82 shadow-[0_24px_80px_rgba(17,19,24,0.14)] dark:bg-[#11141a]/92 dark:shadow-[0_24px_80px_rgba(0,0,0,0.34)] lg:grid-cols-[11.5rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-foreground/8 bg-foreground/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.035] lg:block" aria-label="Locked Desk navigation preview">
            <div className="flex items-center gap-3">
              <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-foreground">{artist.name} Desk</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#16883f]">Spotify found</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              {["Desk HQ", "Catalog", "Manager", "Agents", "Missions"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-[10px] border border-foreground/8 bg-background/70 px-3 py-2 text-[12px] font-bold text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]">
                  <span>{item}</span>
                  <Lock className="h-3.5 w-3.5" aria-label={`${item} locked`} />
                </div>
              ))}
            </div>
          </aside>

          <div className="relative min-h-0 overflow-hidden p-3 sm:p-4 lg:p-5">
            <div className="pointer-events-none absolute inset-0 blur-[5px]">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.7fr)]">
                <div className="rounded-[12px] border border-foreground/8 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Today's Brief</p>
                  <div className="mt-4 h-6 w-3/4 rounded bg-foreground/12 dark:bg-white/14" />
                  <div className="mt-3 h-3 w-full rounded bg-foreground/8 dark:bg-white/10" />
                  <div className="mt-2 h-3 w-5/6 rounded bg-foreground/8" />
                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="rounded-[10px] border border-foreground/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.055]">
                        <div className="h-3 w-16 rounded bg-foreground/10 dark:bg-white/12" />
                        <div className="mt-4 h-7 rounded bg-foreground/8 dark:bg-white/10" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[12px] border border-foreground/8 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Attention Queue</p>
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="mt-3 rounded-[10px] border border-foreground/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.055]">
                      <div className="h-3 w-2/3 rounded bg-foreground/10 dark:bg-white/12" />
                      <div className="mt-3 h-3 w-full rounded bg-foreground/8 dark:bg-white/10" />
                    </div>
                  ))}
                </div>
                <div className="rounded-[12px] border border-foreground/8 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.045] lg:col-span-2">
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Locked Agent Workspace</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {["Manager", "A&R", "Catalog", "Campaign"].map((label) => (
                      <div key={label} className="rounded-[10px] border border-foreground/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.055]">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold text-foreground/70">{label}</span>
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="mt-5 h-3 rounded bg-foreground/8" />
                        <div className="mt-2 h-3 w-2/3 rounded bg-foreground/8" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 bg-background/40 dark:bg-[#0d0f13]/58" />
            <div className="relative z-10 mx-auto flex h-full min-h-0 max-w-[30rem] items-center justify-center py-4">
              <section className="w-full rounded-[16px] border border-foreground/10 bg-white/94 p-4 shadow-[0_24px_80px_rgba(17,19,24,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-[#171b22]/94 dark:shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-5">
                <div className="flex items-center gap-3">
                  <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-foreground">{artist.name}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">
                      {artist.followers ? `${artist.followers.toLocaleString()} followers` : "Spotify artist"}
                    </p>
                  </div>
                </div>

                {genreLine ? <p className="mt-4 text-[12px] font-bold text-[#16883f]">{genreLine}</p> : null}
                <h1 className="font-display mt-4 text-[25px] font-semibold leading-[1.02] tracking-tight text-foreground sm:text-[28px]">
                  We found the artist. Unlock the operating desk before AI setup starts.
                </h1>
                <p className="mt-4 text-[13px] font-semibold leading-relaxed text-muted-foreground">
                  Includes AI setup, catalog import, Manager brief, music reads, and locked agent workspace access.
                </p>

                <div className="mt-4 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.045]">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-ui text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Subscription</p>
                      <p className="mt-1 text-[26px] font-black leading-none text-foreground">{price}/month</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-foreground/10 bg-background px-2.5 py-1 text-[11px] font-bold text-muted-foreground dark:border-white/10 dark:bg-white/[0.055]">
                      <Lock className="h-3.5 w-3.5" />
                      Locked
                    </span>
                  </div>
                  <p className="mt-3 text-[12px] font-semibold leading-relaxed text-muted-foreground">
                    Cancel anytime. Setup starts after payment is confirmed.
                  </p>
                </div>

                {error ? <p className="mt-3 rounded-[12px] border border-[#ef4444]/20 bg-[#ef4444]/5 p-3 text-[12px] font-bold text-[#b91c1c]">{error}</p> : null}

                <button
                  type="button"
                  onClick={() => void onSubscribe()}
                  disabled={pending}
                  className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-foreground px-5 text-[13px] font-bold text-background shadow-md transition-all hover:bg-foreground/90 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" aria-hidden="true" />
                  {pending ? "Opening secure checkout" : `Subscribe ${price}/month`}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>

                <a
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block truncate text-center text-[12px] font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  View Spotify source
                </a>
              </section>
            </div>
          </div>
        </section>
      </div>
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

function formatPaywallPrice(preview: ProductionBillingCheckoutPreview) {
  const amount = Number.isFinite(preview.amount) ? preview.amount : preview.amountMinor / 100;
  const currency = preview.currency || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(amount % 1 ? 2 : 0)}`;
  }
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
  return Boolean(profile.goal.trim() && profile.budget.trim());
}

function getCatalogStatusMessage(status: "queued" | "running" | "needs_context" | "completed" | "completed_with_limits" | "failed" | "cancelled" | undefined) {
  if (status === "queued" || status === "running") {
    return "Spotify catalog import is running in the background.";
  }

  if (status === "completed_with_limits") {
    return "Spotify catalog import completed with public catalog limits.";
  }

  return null;
}
