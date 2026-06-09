import { Activity, Globe2, LogOut, RadioTower } from "lucide-react";
import type { ReactNode } from "react";
import { Field, ProductButton, TextAreaField, WorkspaceShell } from "../../design-system/components";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";

export function SettingsScreen({
  profile,
  onChange,
  onBack,
  onSignOut,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onBack: () => void;
  onSignOut?: () => void;
}) {
  const update = (key: keyof ArtistProfileViewModel, value: string) => onChange({ ...profile, [key]: value });

  return (
    <WorkspaceShell eyebrow="Settings" title="Artist profile" onBack={onBack}>
      <section className="rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 border-b border-foreground/8 pb-5 sm:flex-row sm:items-center sm:justify-between">
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
