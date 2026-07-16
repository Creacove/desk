import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Field, ProductButton, TextAreaField, WorkspaceShell, WorkspaceTabRail } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type { ResolvedThemeMode, ThemeMode } from "../../app/theme";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";
import type { ProductionWorkspace } from "../../types/productionApp";

export function SettingsScreen({
  profile,
  onChange,
  onBack,
  onSignOut,
  themeMode = "system",
  resolvedThemeMode = "light",
  onThemeModeChange,
  workspace,
  onUpdatePassword,
  onManageBilling,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onBack: () => void;
  onSignOut?: () => void;
  themeMode?: ThemeMode;
  resolvedThemeMode?: ResolvedThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  workspace?: ProductionWorkspace;
  onUpdatePassword?: (input: { password: string }) => Promise<void>;
  onManageBilling?: () => Promise<void> | void;
}) {
  const update = (key: keyof ArtistProfileViewModel, value: string) => onChange({ ...profile, [key]: value });
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "access", label: "Access" },
    { id: "account", label: "Account" },
  ];

  return (
    <WorkspaceShell eyebrow="Workspace" title="Settings" onBack={onBack}>
      <div className="sticky top-[109px] z-20 -mx-3 mb-4 border-y border-foreground/8 bg-background/95 px-3 py-2 backdrop-blur-xl lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <WorkspaceTabRail ariaLabel="Settings sections" semanticTabs idPrefix="settings" items={tabs} active={activeTab} onChange={setActiveTab} className="grid-cols-3 lg:max-w-md" />
      </div>

      <div id={`settings-panel-${activeTab}`} role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === "profile" ? <ProfileSettings profile={profile} update={update} /> : null}
        {activeTab === "access" ? (workspace ? <AccessSummary workspace={workspace} onManageBilling={onManageBilling} /> : <AccessEmptyState />) : null}
        {activeTab === "account" ? (
          <AccountSettings
            mode={themeMode}
            resolvedMode={resolvedThemeMode}
            onThemeModeChange={onThemeModeChange}
            onUpdatePassword={onUpdatePassword}
            onSignOut={onSignOut}
          />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

type SettingsTab = "profile" | "access" | "account";

function ProfileSettings({ profile, update }: { profile: ArtistProfileViewModel; update: (key: keyof ArtistProfileViewModel, value: string) => void }) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background p-4 shadow-sm sm:p-5">
      <div data-testid="settings-mobile-profile-summary" className="mb-5 border-b border-foreground/8 pb-4 sm:hidden">
        <ArtistSummary profile={profile} compact />
      </div>
      <div data-testid="settings-desktop-profile-summary" className="mb-6 hidden border-b border-foreground/8 pb-5 sm:flex">
        <ArtistSummary profile={profile} />
      </div>

      <SettingsGroup title="Identity">
        <Field label="Artist name" value={profile.name} onChange={(value) => update("name", value)} />
        <Field label="Artist profile" value={profile.spotify} onChange={(value) => update("spotify", value)} />
      </SettingsGroup>
      <SettingsGroup title="Career context">
        <Field label="Artist stage" value={profile.stage} onChange={(value) => update("stage", value)} />
        <Field label="Home market" value={profile.market} onChange={(value) => update("market", value)} />
        <Field label="Genre" value={profile.genre} onChange={(value) => update("genre", value)} />
        <Field label="Active release" value={profile.release} onChange={(value) => update("release", value)} />
      </SettingsGroup>
      <SettingsGroup title="Operating context">
        <TextAreaField label="Artist goals" value={profile.goal} onChange={(value) => update("goal", value)} />
        <Field label="Monthly budget" value={profile.budget} onChange={(value) => update("budget", value)} />
      </SettingsGroup>
      <SettingsGroup title="Channels" last>
        <Field label="TikTok" value={profile.tiktok} onChange={(value) => update("tiktok", value)} />
        <Field label="Instagram" value={profile.instagram} onChange={(value) => update("instagram", value)} />
        <Field label="YouTube" value={profile.youtube} onChange={(value) => update("youtube", value)} />
        <Field label="X" value={profile.x} onChange={(value) => update("x", value)} />
      </SettingsGroup>
    </section>
  );
}

function ArtistSummary({ profile, compact = false }: { profile: ArtistProfileViewModel; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {profile.imageUrl ? (
        <img className={cn("shrink-0 rounded-[14px] object-cover", compact ? "h-12 w-12" : "h-14 w-14")} src={profile.imageUrl} alt={compact ? "" : `${profile.name} artist image`} />
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-[14px] border border-foreground/10 bg-foreground/[0.035] font-bold text-muted-foreground", compact ? "h-12 w-12 text-[16px]" : "h-14 w-14 text-[18px]")}>
          {profile.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Active artist</p>
        <p className={cn("mt-1 truncate font-display font-bold tracking-tight text-foreground", compact ? "text-[18px]" : "text-[20px]")}>{profile.name}</p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-muted-foreground">{[profile.market, profile.genre].filter(Boolean).join(" / ")}</p>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children, last = false }: { title: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn("py-5 first:pt-0", !last && "border-b border-foreground/8")}>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function AccessSummary({ workspace, onManageBilling }: { workspace: ProductionWorkspace; onManageBilling?: () => Promise<void> | void }) {
  const [portalPending, setPortalPending] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const paid = workspace.accessType === "paid_subscription" || (workspace.accessType == null && workspace.subscriptionStatus && workspace.subscriptionStatus !== "none");
  const accessLabel = paid
    ? "Paid subscription"
    : workspace.accessType === "private_beta"
      ? "Private beta"
      : workspace.entitlementActive
        ? "Active workspace access"
        : "No active access";
  return (
    <section className="overflow-hidden rounded-[16px] border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Workspace access</p>
      <h2 className="mt-2 font-display text-[24px] font-bold tracking-tight text-foreground">{accessLabel}</h2>
      <dl className="mt-6 divide-y divide-foreground/8 border-y border-foreground/8 text-[13px]">
        <AccessRow label="Status" value={workspace.accessStatus ?? (workspace.entitlementActive ? "Active" : "Inactive")} />
        {workspace.accessStartsAt ? <AccessRow label="Started" value={formatDate(workspace.accessStartsAt)} /> : null}
        {paid && workspace.renewalAt ? <AccessRow label="Renews" value={formatDate(workspace.renewalAt)} /> : null}
        {!paid && workspace.accessEndsAt ? <AccessRow label="Expires" value={formatDate(workspace.accessEndsAt)} /> : null}
      </dl>
      {paid && workspace.billingProvider === "paddle" && onManageBilling ? (
        <div className="mt-5">
          <ProductButton
            variant="secondary"
            disabled={portalPending}
            onClick={async () => {
              try {
                setPortalPending(true);
                setPortalError(null);
                await onManageBilling();
              } catch (error) {
                setPortalError(error instanceof Error ? error.message : "Billing portal could not be opened.");
              } finally {
                setPortalPending(false);
              }
            }}
          >
            {portalPending ? "Opening billing" : "Manage billing"}
          </ProductButton>
          {portalError ? <p role="alert" className="mt-3 text-[12px] font-semibold text-red-600">{portalError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function AccessRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-4"><dt className="font-semibold text-muted-foreground">{label}</dt><dd className="text-right font-bold capitalize text-foreground">{value}</dd></div>;
}

function AccessEmptyState() {
  return (
    <section className="rounded-[16px] border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Workspace access</p>
      <h2 className="mt-2 font-display text-[24px] font-bold tracking-tight text-foreground">Access details unavailable</h2>
      <p className="mt-3 max-w-lg text-[13px] font-semibold leading-relaxed text-muted-foreground">Your plan details will appear here when this workspace finishes loading.</p>
    </section>
  );
}

function AccountSettings({
  mode,
  resolvedMode,
  onThemeModeChange,
  onUpdatePassword,
  onSignOut,
}: {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  onUpdatePassword?: (input: { password: string }) => Promise<void>;
  onSignOut?: () => void;
}) {
  return (
    <div className="space-y-4">
      <AppearanceControl mode={mode} resolvedMode={resolvedMode} onChange={onThemeModeChange} />
      {onUpdatePassword ? <PasswordSettings onUpdatePassword={onUpdatePassword} /> : null}
      {onSignOut ? (
        <section className="rounded-[16px] border border-foreground/10 bg-background p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold text-foreground">Sign out</p>
              <p className="mt-1 text-[12px] font-semibold text-muted-foreground">Return to the sign-in screen on this device.</p>
            </div>
            <ProductButton variant="secondary" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </ProductButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PasswordSettings({ onUpdatePassword }: { onUpdatePassword: (input: { password: string }) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setMessage("Use at least eight characters.");
    if (password !== confirmation) return setMessage("The passwords do not match.");
    try {
      setPending(true);
      await onUpdatePassword({ password });
      setPassword("");
      setConfirmation("");
      setMessage("Password updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password could not be updated.");
    } finally {
      setPending(false);
    }
  }
  return <section className="rounded-[16px] border border-foreground/10 bg-background p-5 shadow-sm"><p className="text-[11px] font-bold text-foreground">Password</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit}><Field label="New password" value={password} onChange={setPassword} type="password" /><Field label="Confirm password" value={confirmation} onChange={setConfirmation} type="password" />{message ? <p className="text-[12px] font-semibold text-muted-foreground sm:col-span-2">{message}</p> : null}<div className="sm:col-span-2"><ProductButton type="submit" disabled={pending}>{pending ? "Updating password" : "Change password"}</ProductButton></div></form></section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
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
    <section className="rounded-[16px] border border-foreground/10 bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Appearance</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{status}</p>
        </div>
        <div className="grid min-w-0 grid-cols-3 rounded-[12px] border border-foreground/10 bg-foreground/[0.035] p-1">
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
                  "inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-2 font-ui text-[11px] font-bold transition-all sm:gap-2 sm:px-3 sm:text-[12px]",
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

