import { ArrowLeft, ArrowRight, LoaderCircle, Lock, LogOut, Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";
import type {
  ProductionBillingCheckoutPreview,
  ProductionSpotifyArtistCandidate,
  ProductionSpotifyCatalogPreview,
} from "../../types/productionApp";

export function ConnectArtistScreen({
  profile,
  query = "",
  candidates = [],
  pending = false,
  message,
  selectedArtistName,
  selectedArtistId,
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
  selectedArtistName?: string | null;
  selectedArtistId?: string | null;
  onQueryChange?: (query: string) => void;
  onSelectCandidate?: (candidate: ProductionSpotifyArtistCandidate) => void;
  onContinue?: () => void;
  onSignOut?: () => void;
}) {
  const searchMode = Boolean(onQueryChange && onSelectCandidate);
  const selectedCandidate = selectedArtistId
    ? candidates.find((candidate) => candidate.spotifyArtistId === selectedArtistId)
    : selectedArtistName
      ? candidates.find((candidate) => candidate.name === selectedArtistName)
      : undefined;
  const selecting = Boolean(selectedArtistName && pending);
  const presentedMessage = message ? friendlyArtistSearchMessage(message) : null;

  return (
    <FrontDoorPage onSignOut={onSignOut}>
      <section className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[68rem] flex-col justify-center py-10 sm:py-14 lg:py-16">
        <div className="w-full max-w-[46rem]">
          <h1 className="max-w-[13ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground sm:text-[40px] lg:text-[48px]">
            {searchMode ? "Find your artist." : "Your artist."}
          </h1>

          {searchMode ? (
            <div className="mt-8 sm:mt-10">
              <label htmlFor="artist-search" className="sr-only">Search artist name</label>
              <div className="relative border-b border-foreground/18 pb-2 transition-colors focus-within:border-brand-accent/55">
                <Search className="pointer-events-none absolute left-0 top-[13px] h-4 w-4 text-muted-foreground/65" aria-hidden="true" />
                <input
                  id="artist-search"
                  aria-label="Search artist name"
                  value={query}
                  autoComplete="off"
                  onChange={(event: { target: { value: string } }) => onQueryChange?.(event.target.value)}
                  placeholder="Search artist name"
                  className="h-11 w-full bg-transparent pl-7 pr-3 text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground/48"
                />
              </div>

              <div className="mt-5" aria-live="polite">
                {pending && !selecting ? (
                  <div data-testid="artist-search-loader" className="flex min-h-11 items-center gap-2 text-[12px] font-medium text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-accent motion-safe:animate-pulse" aria-hidden="true" />
                    Looking…
                  </div>
                ) : null}

                {presentedMessage && !selecting ? (
                  <p className="py-2 text-[12px] font-medium text-muted-foreground">{presentedMessage}</p>
                ) : null}

                {candidates.length ? (
                  <div className="divide-y divide-foreground/8 border-t border-foreground/8">
                    {candidates.map((candidate) => {
                      const isSelected = selecting && (selectedArtistId ? candidate.spotifyArtistId === selectedArtistId : candidate.name === selectedArtistName);
                      const isReceding = selecting && !isSelected;
                      return (
                        <button
                          key={candidate.spotifyArtistId}
                          type="button"
                          disabled={selecting}
                          aria-label={`Select artist ${candidate.name}`}
                          onClick={() => onSelectCandidate?.(candidate)}
                          className={cn(
                            "group flex min-h-[68px] w-full min-w-0 items-center gap-3 py-3 text-left transition-[opacity,transform,background-color] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25",
                            !selecting && "hover:bg-foreground/[0.025]",
                            isSelected && "translate-x-1",
                            isReceding && "opacity-28",
                          )}
                        >
                          <ArtistAvatar name={candidate.name} imageUrl={candidate.imageUrl} size={isSelected ? "lg" : "md"} shared={isSelected} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold text-foreground">{candidate.name}</span>
                            <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground/72">
                              {candidateMeta(candidate)}
                            </span>
                            {isSelected ? (
                              <span className="mt-1.5 block text-[11px] font-semibold text-brand-accent">
                                Found. Opening the Desk preview.
                              </span>
                            ) : null}
                          </span>
                          {!selecting ? (
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/55 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
                          ) : isSelected ? (
                            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-brand-accent motion-reduce:animate-none" aria-hidden="true" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {selecting && !selectedCandidate ? (
                  <div className="flex min-h-[72px] items-center gap-3 border-y border-foreground/8 py-3">
                    <ArtistAvatar name={selectedArtistName ?? "Artist"} size="lg" shared />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-foreground">{selectedArtistName}</p>
                      <p className="mt-1 text-[11px] font-semibold text-brand-accent">Found. Opening the Desk preview.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : profile ? (
            <div className="mt-9 max-w-[34rem]">
              <div className="flex items-center gap-4 border-y border-foreground/8 py-4">
                <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} size="lg" shared />
                <p className="min-w-0 flex-1 truncate text-[18px] font-semibold text-foreground">{profile.name}</p>
              </div>
              <Button
                type="button"
                onClick={onContinue}
                trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                className="mt-6 w-full sm:w-auto"
              >
                Continue
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    </FrontDoorPage>
  );
}

export function SetupScreen({
  profile,
  onChange,
  onBack,
  onContinue,
  pending = false,
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
  const update = (key: "goal" | "budget", value: string) => onChange({ ...profile, [key]: value });
  const complete = Boolean(profile.goal.trim() && profile.budget.trim());

  return (
    <FrontDoorPage onSignOut={onSignOut}>
      <section className="mx-auto w-full max-w-[68rem] pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 sm:pt-8 lg:pt-12">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <div className="flex min-w-0 items-center gap-3">
              <ArtistAvatar name={profile.name} imageUrl={profile.imageUrl} size="lg" shared />
              <p className="min-w-0 truncate text-[15px] font-semibold text-foreground">{profile.name}</p>
            </div>
            <h1 className="mt-8 max-w-[11ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground sm:text-[40px] lg:mt-12 lg:text-[46px]">
              Give your Manager the starting point.
            </h1>
          </div>

          <div className="min-w-0 space-y-9 lg:pt-14">
            <ContextQuestion
              label="What are you trying to make happen next?"
              hint="You can change this later."
            >
              <textarea
                id="artist-goal"
                aria-label="What are you trying to make happen next?"
                value={profile.goal}
                onChange={(event: { target: { value: string } }) => update("goal", event.target.value)}
                placeholder="Break this single in the UK, plan my next release, grow live demand…"
                className="mt-3 min-h-[116px] w-full resize-none border-b border-foreground/16 bg-transparent pb-4 text-[16px] font-medium leading-[1.55] text-foreground outline-none transition-colors placeholder:text-muted-foreground/42 focus:border-brand-accent/55"
              />
            </ContextQuestion>

            <ContextQuestion
              label="What can you realistically spend each month?"
              hint="Use your usual currency."
            >
              <input
                id="artist-budget"
                aria-label="What can you realistically spend each month?"
                value={profile.budget}
                inputMode="text"
                autoComplete="off"
                onChange={(event: { target: { value: string } }) => update("budget", event.target.value)}
                placeholder="₦500,000"
                className="mt-3 h-12 w-full border-b border-foreground/16 bg-transparent text-[16px] font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground/42 focus:border-brand-accent/55"
              />
            </ContextQuestion>

            <div className="sticky bottom-0 -mx-1 bg-background/96 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-sm sm:static sm:m-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <Button
                type="button"
                onClick={() => onContinue(profile)}
                disabled={!complete}
                pending={pending}
                trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
                size="lg"
                className="w-full sm:w-auto"
              >
                Build my Desk
              </Button>
            </div>
          </div>
        </div>
      </section>
    </FrontDoorPage>
  );
}

export function PaywallPreviewScreen({
  preview,
  catalogPreview,
  pending = false,
  error,
  onSubscribe,
  onIntervalChange,
  onProviderChange,
  onRedeemPrivateBeta,
  privateBetaEnabled = false,
  onBack,
  onSignOut,
}: {
  preview: ProductionBillingCheckoutPreview;
  catalogPreview?: ProductionSpotifyCatalogPreview | null;
  pending?: boolean;
  error?: string | null;
  onSubscribe: (interval: "monthly" | "yearly") => void | Promise<void>;
  onIntervalChange?: (interval: "monthly" | "yearly") => void | Promise<void>;
  onProviderChange?: (provider: "paddle" | "paystack", interval: "monthly" | "yearly") => void | Promise<void>;
  onRedeemPrivateBeta?: (code: string) => void | Promise<void>;
  privateBetaEnabled?: boolean;
  onBack: () => void;
  onSignOut?: () => void;
}) {
  const [showBetaCode, setShowBetaCode] = useState(false);
  const [betaCode, setBetaCode] = useState("");
  const [betaSubmitting, setBetaSubmitting] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<"monthly" | "yearly">(preview.interval);
  const artist = preview.artist;
  const intervalOption = preview.intervalOptions?.[selectedInterval];
  const displayPreview = { ...preview, ...intervalOption, interval: selectedInterval };
  const price = formatPaywallPrice(displayPreview);
  const intervalLabel = selectedInterval === "yearly" ? "year" : "month";
  const latestProject = catalogPreview?.latestProject ?? null;
  const standaloneSingles = catalogPreview?.standaloneSingles.slice(0, 6) ?? [];
  const visibleMusic = [latestProject, ...standaloneSingles]
    .filter((release): release is NonNullable<typeof release> => Boolean(release))
    .filter((release, index, all) => all.findIndex((candidate) => candidate.spotifyAlbumId === release.spotifyAlbumId) === index)
    .slice(0, 5);
  const checkoutError = error ? friendlyCheckoutMessage(error) : null;

  return (
    <main aria-label="Desk preview" className="app-theme h-dvh overflow-hidden bg-background text-foreground lg:h-auto lg:min-h-dvh lg:overflow-x-hidden">
      <div className="mx-auto h-full w-full max-w-[92rem] overflow-hidden px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:h-auto lg:overflow-visible lg:px-8 lg:pt-5">
        <FrontDoorHeader onSignOut={onSignOut} />

        <button
          type="button"
          onClick={onBack}
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Choose another artist
        </button>

        <section className="relative mt-4 h-[calc(100dvh-8.5rem)] min-h-0 overflow-hidden lg:grid lg:h-auto lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.42fr)] lg:items-start lg:gap-12">
          <div
            data-testid="paywall-preview-layer"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 min-w-0 overflow-hidden rounded-[22px] border border-foreground/8 bg-foreground/[0.018] p-4 sm:p-6 lg:pointer-events-auto lg:relative lg:inset-auto lg:grid lg:grid-cols-[10.5rem_minmax(0,1fr)] lg:gap-7 lg:overflow-visible lg:p-7"
          >
            <aside className="hidden lg:block">
              <div className="flex items-center gap-3">
                <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size="lg" />
                <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">{artist.name}</p>
              </div>
              <nav className="mt-8 space-y-1" aria-label="Desk preview navigation">
                {["Home", "Catalog", "Manager", "Missions"].map((item, index) => (
                  <div
                    key={item}
                    className={cn(
                      "rounded-[8px] px-2.5 py-2 text-[11px] font-semibold",
                      index === 0 ? "bg-foreground/[0.055] text-foreground" : "text-muted-foreground/68",
                    )}
                  >
                    {item}
                  </div>
                ))}
              </nav>
            </aside>

            <div className="min-w-0">
              <div className="flex items-center gap-3 lg:hidden">
                <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size="lg" />
                <p className="min-w-0 truncate text-[15px] font-semibold text-foreground">{artist.name}</p>
              </div>

              <div className="mt-7 lg:mt-0">
                <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/58">Latest music</p>
                {visibleMusic.length ? (
                  <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-4 lg:overflow-visible">
                    {visibleMusic.slice(0, 4).map((release) => (
                      <article key={release.spotifyAlbumId} className="w-[116px] shrink-0 snap-start lg:w-auto">
                        <MusicArtwork name={release.name} imageUrl={release.artworkUrl} />
                        <p className="mt-2 truncate text-[11px] font-semibold text-foreground">{release.name}</p>
                        {release.releaseDate ? <p className="mt-0.5 text-[9px] font-medium text-muted-foreground/58">{release.releaseDate.slice(0, 4)}</p> : null}
                        {release === latestProject && release.tracks.length ? (
                          <div className="mt-1 grid gap-0.5">
                            {release.tracks.slice(0, 3).map((track) => <p key={track.spotifyTrackId} className="truncate text-[9px] font-medium text-muted-foreground/72">{track.name}</p>)}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 aspect-[4/1] max-h-28 rounded-[14px] border border-foreground/8 bg-foreground/[0.025]" />
                )}
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <LockedIntelligencePreview label="Audience intelligence" lines={AUDIENCE_PREVIEW_LINES} />
                <LockedIntelligencePreview label="Manager's read" lines={MANAGER_READ_PREVIEW_LINES} />
              </div>
            </div>
          </div>

          <div data-testid="paywall-mobile-veil" aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-background/58 backdrop-blur-[2px] dark:bg-[#0d0f13]/68 lg:hidden" />

          <aside
            data-testid="paywall-checkout-card"
            aria-label="Subscription checkout"
            className="fixed inset-x-3 top-32 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-20 min-w-0 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-[20px] border border-foreground/10 bg-background/95 p-4 shadow-[0_26px_88px_rgba(17,19,24,0.28)] backdrop-blur-xl sm:inset-x-5 sm:p-5 lg:sticky lg:top-7 lg:z-auto lg:max-h-none lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none"
          >
            <div className="flex items-center gap-3">
              <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size="md" shared />
              <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">{artist.name}</p>
            </div>

            <h1 className="mt-7 max-w-[12ch] font-display text-[32px] font-semibold leading-[0.98] tracking-[-0.035em] text-foreground sm:text-[38px]">
              Open {artist.name}&rsquo;s Desk.
            </h1>
            <p className="mt-3 max-w-[27rem] text-[13px] font-medium leading-relaxed text-muted-foreground/72">
              Your desk opens with catalog import, audience intelligence, Manager brief, and music reads.
            </p>

            <div className="mt-7 grid grid-cols-2 rounded-[10px] bg-foreground/[0.045] p-1" aria-label="Billing interval">
              {(["monthly", "yearly"] as const).map((interval) => {
                const active = selectedInterval === interval;
                return (
                  <button
                    key={interval}
                    type="button"
                    aria-pressed={active}
                    disabled={pending}
                    onClick={() => {
                      setSelectedInterval(interval);
                      void onIntervalChange?.(interval);
                    }}
                    className={cn(
                      "min-h-10 rounded-[8px] text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25",
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {interval === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-end justify-between gap-3 border-b border-foreground/10 pb-5">
              <p className="text-[27px] font-semibold tracking-[-0.035em] text-foreground sm:text-[30px]">{price}</p>
              <p className="pb-1 text-[11px] font-medium text-muted-foreground">per {intervalLabel}</p>
            </div>

            {checkoutError ? <p className="mt-4 text-[12px] font-semibold text-warning">{checkoutError}</p> : null}

            <Button
              type="button"
              onClick={() => void onSubscribe(selectedInterval)}
              pending={pending}
              trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              size="lg"
              className="mt-5 w-full"
            >
              Start my Desk
            </Button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted-foreground/60">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Secure checkout
            </div>

            {preview.provider === "paystack" && preview.currency === "NGN" && onProviderChange ? (
              <button
                type="button"
                onClick={() => void onProviderChange("paddle", selectedInterval)}
                disabled={pending}
                className="mt-4 w-full text-center text-[11px] font-semibold text-muted-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground disabled:opacity-45"
              >
                Pay in USD
              </button>
            ) : null}

            {privateBetaEnabled && onRedeemPrivateBeta ? (
              <div className="mt-4 border-t border-foreground/8 pt-4">
                {!showBetaCode ? (
                  <button
                    type="button"
                    onClick={() => setShowBetaCode(true)}
                    className="w-full text-center text-[11px] font-semibold text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
                  >
                    Have an access code?
                  </button>
                ) : (
                  <form
                    className="space-y-2"
                    onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      const normalized = betaCode.trim().toUpperCase();
                      if (!normalized || betaSubmitting) return;
                      try {
                        setBetaSubmitting(true);
                        await onRedeemPrivateBeta(normalized);
                      } finally {
                        setBetaSubmitting(false);
                      }
                    }}
                  >
                    <label htmlFor="access-code" className="sr-only">Access code</label>
                    <input
                      id="access-code"
                      value={betaCode}
                      onChange={(event: { target: { value: string } }) => setBetaCode(event.target.value)}
                      disabled={pending || betaSubmitting}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Access code"
                      className="h-11 w-full rounded-[9px] border border-foreground/12 bg-transparent px-3 text-[16px] font-semibold uppercase text-foreground outline-none focus:border-brand-accent/45"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      pending={betaSubmitting}
                      disabled={pending || !betaCode.trim()}
                      className="w-full"
                    >
                      Activate access
                    </Button>
                  </form>
                )}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function FrontDoorPage({ children, onSignOut }: { children: ReactNode; onSignOut?: () => void }) {
  return (
    <main className="app-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-[92rem] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pt-5">
        <FrontDoorHeader onSignOut={onSignOut} />
        {children}
      </div>
    </main>
  );
}

function FrontDoorHeader({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="flex min-h-11 items-center justify-between">
      <div className="flex items-center gap-2.5">
        <BrandMark size="sm" />
        <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">Desk</span>
      </div>
      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </button>
      ) : null}
    </header>
  );
}

function ArtistAvatar({ name, imageUrl, size = "md", shared = false }: { name: string; imageUrl?: string; size?: "md" | "lg"; shared?: boolean }) {
  const dimensions = size === "lg" ? "h-14 w-14 rounded-[14px]" : "h-12 w-12 rounded-[12px]";
  const sharedClass = shared ? "[view-transition-name:front-door-artist]" : undefined;
  if (imageUrl) {
    return <img className={cn(dimensions, sharedClass, "shrink-0 object-cover")} src={imageUrl} alt={`${name} artist image`} />;
  }
  return (
    <span
      aria-label={`${name} artist image unavailable`}
      className={cn(dimensions, sharedClass, "flex shrink-0 items-center justify-center bg-foreground/[0.055] font-display text-[15px] font-semibold text-foreground")}
    >
      {artistInitials(name)}
    </span>
  );
}

function MusicArtwork({ name, imageUrl }: { name: string; imageUrl?: string }) {
  return (
    <div className="aspect-square w-full overflow-hidden rounded-[12px] bg-foreground/[0.045]">
      {imageUrl ? (
        <img src={imageUrl} alt={`${name} artwork`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-muted-foreground">{artistInitials(name)}</div>
      )}
    </div>
  );
}

type LockedInsightLine = {
  eyebrow: string;
  copy: string;
};

const AUDIENCE_PREVIEW_LINES: LockedInsightLine[] = [
  { eyebrow: "Listener signal", copy: "A clearer picture of who is leaning in appears here." },
  { eyebrow: "Discovery pattern", copy: "The strongest paths into the catalog are waiting to be read." },
  { eyebrow: "Next opportunity", copy: "Unlock the Desk to see the audience move worth acting on." },
];

const MANAGER_READ_PREVIEW_LINES: LockedInsightLine[] = [
  { eyebrow: "Priority", copy: "The next move is shaped by the strongest current signal." },
  { eyebrow: "Timing", copy: "Release context and audience response are read together." },
  { eyebrow: "Recommendation", copy: "Unlock the Manager's view to see the focused action." },
];

function LockedIntelligencePreview({ label, lines }: { label: string; lines: readonly LockedInsightLine[] }) {
  const testId = label.replace(/[’']/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

  return (
    <section className="relative overflow-hidden rounded-[14px] border border-foreground/10 bg-background/55 p-3 pt-4 dark:border-white/10 dark:bg-white/[0.06]" aria-label={`${label} preview locked`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/28 via-transparent to-brand-accent/[0.08] dark:from-white/[0.05] dark:to-brand-accent/[0.12]" aria-hidden="true" />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/78">{label}</p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-foreground/10 bg-background/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground/72 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/70">
            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
            Locked
          </span>
        </div>
        <div data-testid={`paywall-locked-insight-copy-${testId}`} className="mt-3 grid gap-2 select-none" aria-hidden="true">
          {lines.map((line) => (
            <div key={`${label}-${line.eyebrow}`} className="rounded-[9px] border border-foreground/8 bg-foreground/[0.035] px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.05]">
              <p className="font-ui text-[8px] font-bold uppercase tracking-[0.1em] text-foreground/82 blur-[3px] dark:text-white/78">{line.eyebrow}</p>
              <p className="mt-1 text-[10px] font-semibold leading-snug text-foreground/78 blur-[3px] dark:text-white/72">{line.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContextQuestion({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="max-w-[28rem] font-display text-[23px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[26px]">{label}</h2>
      {children}
      {hint ? <p className="mt-2 text-[10px] font-medium text-muted-foreground/58">{hint}</p> : null}
    </section>
  );
}

function candidateMeta(candidate: ProductionSpotifyArtistCandidate) {
  const parts: string[] = [];
  if (candidate.genres.length) parts.push(candidate.genres.slice(0, 2).join(", "));
  if (candidate.followers) parts.push(`${candidate.followers.toLocaleString()} followers`);
  return parts.join(" · ") || "Artist";
}

function friendlyArtistSearchMessage(message: string) {
  return /no artists|no match/i.test(message)
    ? "No match yet. Try another spelling."
    : "Couldn’t search right now. Try again.";
}

function friendlyCheckoutMessage(message: string) {
  if (/code|beta|access/i.test(message)) return "That access code didn’t work. Try again.";
  return "Couldn’t open checkout. Try again.";
}

function artistInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatPaywallPrice(preview: ProductionBillingCheckoutPreview) {
  if (preview.formattedTotal) return preview.formattedTotal;
  const amount = Number.isFinite(preview.amount) ? Number(preview.amount) : Number(preview.amountMinor ?? 0) / 100;
  const currency = preview.currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(amount % 1 ? 2 : 0)}`;
  }
}
