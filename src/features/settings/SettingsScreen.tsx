import { Activity, Globe2, LogOut, Monitor, Moon, RadioTower, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Field, ProductButton, TextAreaField, WorkspaceShell } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type { ResolvedThemeMode, ThemeMode } from "../../app/theme";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";

export function SettingsScreen({
  profile,
  onChange,
  onBack,
  onSignOut,
  themeMode = "system",
  resolvedThemeMode = "light",
  onThemeModeChange,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onBack: () => void;
  onSignOut?: () => void;
  themeMode?: ThemeMode;
  resolvedThemeMode?: ResolvedThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}) {
  const update = (key: keyof ArtistProfileViewModel, value: string) => onChange({ ...profile, [key]: value });

  return (
    <WorkspaceShell eyebrow="Settings" title="Artist profile" onBack={onBack}>
      <AppearanceControl mode={themeMode} resolvedMode={resolvedThemeMode} onChange={onThemeModeChange} />
      <section className="rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
        <div data-testid="settings-mobile-profile-summary" className="mb-5 border-b border-foreground/8 pb-4 sm:hidden">
          <div className="flex min-w-0 items-center gap-3">
            {profile.imageUrl ? (
              <img className="h-12 w-12 shrink-0 rounded-[14px] object-cover" src={profile.imageUrl} alt="" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-foreground/10 bg-foreground/[0.035] text-[16px] font-bold text-muted-foreground">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Artist profile</p>
              <p className="mt-1 truncate font-display text-[18px] font-semibold tracking-tight text-foreground">{profile.name}</p>
              <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">{profile.market} / {profile.genre}</p>
            </div>
          </div>
        </div>
        <div data-testid="settings-desktop-profile-summary" className="mb-5 hidden flex-col gap-4 border-b border-foreground/8 pb-5 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {profile.imageUrl ? (
              <img className="h-14 w-14 shrink-0 rounded-[14px] object-cover" src={profile.imageUrl} alt={`${profile.name} artist image`} />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] border border-foreground/10 bg-foreground/[0.035] text-[18px] font-bold text-muted-foreground">
                {profile.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Spotify artist profile</p>
              <p className="mt-1 truncate font-display text-[20px] font-bold tracking-tight text-foreground">{profile.name}</p>
            </div>
          </div>
          <p className="max-w-xl text-[13px] font-semibold leading-relaxed text-muted-foreground/82">Edit the active artist operating profile, connected channels, current goal, budget context, and known limitations.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Artist name" value={profile.name} onChange={(value) => update("name", value)} />
          <Field label="Spotify identity" value={profile.spotify} onChange={(value) => update("spotify", value)} />
          <Field label="Artist stage" value={profile.stage} onChange={(value) => update("stage", value)} />
          <Field label="Home market" value={profile.market} onChange={(value) => update("market", value)} />
          <Field label="Genre" value={profile.genre} onChange={(value) => update("genre", value)} />
          <Field label="Active release" value={profile.release} onChange={(value) => update("release", value)} />
          <Field label="Monthly budget" value={profile.budget} onChange={(value) => update("budget", value)} />
          <Field label="TikTok" value={profile.tiktok} onChange={(value) => update("tiktok", value)} />
          <Field label="Instagram" value={profile.instagram} onChange={(value) => update("instagram", value)} />
          <Field label="YouTube" value={profile.youtube} onChange={(value) => update("youtube", value)} />
          <Field label="X" value={profile.x} onChange={(value) => update("x", value)} />
          <TextAreaField label="Artist Direction" value={profile.goal} onChange={(value) => update("goal", value)} />
        </div>
      </section>
      {profile.artistIntelligence ? (
        <section className="mt-4 rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
          <div className="mb-5 border-b border-foreground/8 pb-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Artist intelligence</p>
            <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-relaxed text-foreground">{profile.artistIntelligence.headline}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <IntelligenceRead icon={<Globe2 className="h-4 w-4" aria-hidden="true" />} label="Markets" value={profile.artistIntelligence.marketRead} />
            <IntelligenceRead icon={<Activity className="h-4 w-4" aria-hidden="true" />} label="Platforms" value={profile.artistIntelligence.platformRead} />
            <IntelligenceRead icon={<RadioTower className="h-4 w-4" aria-hidden="true" />} label="Social" value={profile.artistIntelligence.socialRead} />
          </div>
          {profile.artistIntelligence.limitations.length ? (
            <div className="mt-4 border-t border-foreground/8 pt-4">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Source limits</p>
              <div className="mt-2 grid gap-2">
                {profile.artistIntelligence.limitations.map((limitation) => (
                  <p key={limitation} className="text-[12px] font-semibold leading-relaxed text-muted-foreground/82">{limitation}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {onSignOut ? (
        <section className="mt-4 rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Account</p>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">End this session and return to sign in.</p>
            </div>
            <ProductButton variant="secondary" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </ProductButton>
          </div>
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

function AppearanceControl({
  mode,
  resolvedMode,
  onChange,
}: {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  onChange?: (mode: ThemeMode) => void;
}) {
  const resolvedLabel = resolvedMode === "dark" ? "Dark" : "Light";
  const status = mode === "system" ? `Following system: ${resolvedLabel}` : `Appearance locked to ${resolvedLabel}`;
  const options: Array<{ mode: ThemeMode; label: string; ariaLabel: string; icon: ReactNode }> = [
    { mode: "system", label: "System", ariaLabel: "Use system appearance", icon: <Monitor className="h-3.5 w-3.5" aria-hidden="true" /> },
    { mode: "light", label: "Light", ariaLabel: "Use light appearance", icon: <Sun className="h-3.5 w-3.5" aria-hidden="true" /> },
    { mode: "dark", label: "Dark", ariaLabel: "Use dark appearance", icon: <Moon className="h-3.5 w-3.5" aria-hidden="true" /> },
  ];

  return (
    <section className="mb-4 rounded-xl border border-foreground/10 bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Appearance</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{status}</p>
        </div>
        <div className="grid grid-cols-3 rounded-[12px] border border-foreground/10 bg-foreground/[0.035] p-1">
          {options.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                aria-label={option.ariaLabel}
                aria-pressed={active}
                onClick={() => onChange?.(option.mode)}
                className={cn(
                  "inline-flex h-9 min-w-[5.75rem] items-center justify-center gap-2 rounded-[9px] px-3 font-ui text-[12px] font-bold transition-all",
                  active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/8"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function IntelligenceRead({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/8 bg-foreground/[0.025] p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em]">{label}</p>
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
