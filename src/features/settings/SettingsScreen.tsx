import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Field, TextAreaField, WorkspaceHeader, WorkspaceTabRail } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import type { ResolvedThemeMode, ThemeMode } from "../../app/theme";
import type { ArtistProfileViewModel } from "../../types/cleanProduction";
import type { ProductionWorkspace } from "../../types/productionApp";

export function SettingsScreen({
  profile,
  onChange,
  onSaveProfile,
  onBack: _onBack,
  onSignOut,
  accountEmail,
  themeMode = "system",
  resolvedThemeMode = "light",
  onThemeModeChange,
  workspace,
  onUpdatePassword,
  onManageBilling,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onSaveProfile?: (profile: ArtistProfileViewModel) => Promise<void>;
  onBack: () => void;
  onSignOut?: () => void;
  accountEmail?: string;
  themeMode?: ThemeMode;
  resolvedThemeMode?: ResolvedThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  workspace?: ProductionWorkspace;
  onUpdatePassword?: (input: { password: string }) => Promise<void>;
  onManageBilling?: () => Promise<void> | void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "workspace", label: "Workspace" },
    { id: "preferences", label: "Preferences" },
    { id: "account", label: "Account" },
  ];

  return (
    <section className="app-workspace app-workspace-reveal settings-workspace relative isolate min-w-0 pb-12">
      <WorkspaceHeader title="Settings" />

      <div className="mb-7 border-b border-foreground/8 sm:mb-8">
        <WorkspaceTabRail
          ariaLabel="Settings sections"
          semanticTabs
          idPrefix="settings"
          items={tabs}
          active={activeTab}
          onChange={setActiveTab}
          className="grid-cols-4 lg:max-w-[36rem]"
        />
      </div>

      <div
        id={`settings-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="min-w-0"
      >
        {activeTab === "profile" ? <ProfileSettings profile={profile} onChange={onChange} onSaveProfile={onSaveProfile} /> : null}
        {activeTab === "workspace" ? (workspace ? <AccessSummary workspace={workspace} onManageBilling={onManageBilling} /> : <AccessEmptyState />) : null}
        {activeTab === "preferences" ? (
          <PreferencesSettings mode={themeMode} resolvedMode={resolvedThemeMode} onThemeModeChange={onThemeModeChange} />
        ) : null}
        {activeTab === "account" ? (
          <AccountSettings
            onUpdatePassword={onUpdatePassword}
            onSignOut={onSignOut}
            accountEmail={accountEmail}
          />
        ) : null}
      </div>
    </section>
  );
}

type SettingsTab = "profile" | "workspace" | "preferences" | "account";

function ProfileSettings({
  profile,
  onChange,
  onSaveProfile,
}: {
  profile: ArtistProfileViewModel;
  onChange: (profile: ArtistProfileViewModel) => void;
  onSaveProfile?: (profile: ArtistProfileViewModel) => Promise<void>;
}) {
  const [draft, setDraft] = useState(profile);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  useEffect(() => setDraft(profile), [profile]);

  const update = (key: EditableProfileKey, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveMessage(null);
    setSaveError(null);
  };
  const dirty = !sameEditableProfile(profile, draft);

  async function save() {
    if (!onSaveProfile || !dirty) return;
    try {
      setSavePending(true);
      setSaveMessage(null);
      setSaveError(null);
      await onSaveProfile(draft);
      onChange(draft);
      setSaveMessage("Saved.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Changes could not be saved. Please try again.");
    } finally {
      setSavePending(false);
    }
  }

  return (
    <div className="max-w-[58rem]">
      <div data-testid="settings-mobile-profile-summary" className="mb-7 sm:hidden">
        <ArtistSummary profile={draft} compact />
      </div>
      <div data-testid="settings-desktop-profile-summary" className="mb-8 hidden sm:flex">
        <ArtistSummary profile={draft} />
      </div>

      <div className="border-t border-foreground/8">
        <SettingsGroup title="Identity">
          <Field label="Artist name" value={draft.name} onChange={(value) => update("name", value)} disabled={savePending} />
        </SettingsGroup>
        <SettingsGroup title="Career">
          <Field label="Artist stage" value={draft.stage} onChange={(value) => update("stage", value)} disabled={savePending} />
          <Field label="Home market" value={draft.market} onChange={(value) => update("market", value)} disabled={savePending} />
          <Field label="Genre" value={draft.genre} onChange={(value) => update("genre", value)} disabled={savePending} />
        </SettingsGroup>
        <SettingsGroup title="Direction">
          <TextAreaField label="Artist goals" value={draft.goal} onChange={(value) => update("goal", value)} />
          <Field label="Monthly budget" value={draft.budget} onChange={(value) => update("budget", value)} disabled={savePending} />
        </SettingsGroup>
        <SettingsGroup title="Channels">
          <Field label="TikTok" value={draft.tiktok} onChange={(value) => update("tiktok", value)} disabled={savePending} />
          <Field label="Instagram" value={draft.instagram} onChange={(value) => update("instagram", value)} disabled={savePending} />
          <Field label="YouTube" value={draft.youtube} onChange={(value) => update("youtube", value)} disabled={savePending} />
          <Field label="X" value={draft.x} onChange={(value) => update("x", value)} disabled={savePending} />
        </SettingsGroup>
      </div>

      {onSaveProfile ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-foreground/8 pt-5">
          <Button onClick={() => void save()} disabled={!dirty} pending={savePending}>
            Save changes
          </Button>
          {saveMessage ? <p role="status" className="text-[12px] font-semibold text-muted-foreground">{saveMessage}</p> : null}
          {saveError ? <p role="alert" className="text-[12px] font-medium text-destructive">{saveError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

type EditableProfileKey = "name" | "genre" | "market" | "goal" | "budget" | "stage" | "tiktok" | "instagram" | "youtube" | "x";

const editableProfileKeys: EditableProfileKey[] = ["name", "genre", "market", "goal", "budget", "stage", "tiktok", "instagram", "youtube", "x"];

function sameEditableProfile(a: ArtistProfileViewModel, b: ArtistProfileViewModel) {
  return editableProfileKeys.every((key) => a[key] === b[key]);
}

function ArtistSummary({ profile, compact = false }: { profile: ArtistProfileViewModel; compact?: boolean }) {
  const context = [profile.market, profile.genre].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      {profile.imageUrl ? (
        <img
          className={cn("shrink-0 rounded-xl object-cover", compact ? "h-12 w-12" : "h-14 w-14")}
          src={profile.imageUrl}
          alt={compact ? "" : `${profile.name} artist image`}
        />
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] font-semibold text-muted-foreground", compact ? "h-12 w-12 text-[15px]" : "h-14 w-14 text-[17px]")}>
          {profile.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className={cn("truncate font-display font-semibold tracking-[-0.02em] text-foreground", compact ? "text-[20px]" : "text-[22px]")}>{profile.name}</p>
        {context ? <p className="mt-1 truncate text-[12px] font-medium text-muted-foreground">{context}</p> : null}
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-foreground/8 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
      <h2 className="pt-1 text-[12px] font-semibold text-foreground">{title}</h2>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{children}</div>
    </section>
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
        ? "Active access"
        : "No active access";

  return (
    <div className="max-w-[44rem]">
      <SettingsSectionHeading title="Workspace" />
      <dl className="border-t border-foreground/8 text-[13px]">
        <AccessRow label="Access" value={accessLabel} />
        <AccessRow label="Status" value={workspace.accessStatus ?? (workspace.entitlementActive ? "Active" : "Inactive")} />
        {workspace.accessStartsAt ? <AccessRow label="Started" value={formatDate(workspace.accessStartsAt)} /> : null}
        {paid && workspace.renewalAt ? <AccessRow label="Renews" value={formatDate(workspace.renewalAt)} /> : null}
        {!paid && workspace.accessEndsAt ? <AccessRow label="Expires" value={formatDate(workspace.accessEndsAt)} /> : null}
      </dl>
      {paid && workspace.billingProvider === "paddle" && onManageBilling ? (
        <div className="pt-5">
          <Button
            variant="secondary"
            pending={portalPending}
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
            Manage billing
          </Button>
          {portalError ? <p role="alert" className="mt-3 text-[12px] font-medium text-destructive">{portalError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AccessRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-foreground/8 py-4">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold capitalize text-foreground">{value}</dd>
    </div>
  );
}

function AccessEmptyState() {
  return (
    <div className="max-w-[44rem]">
      <SettingsSectionHeading title="Workspace" />
      <div className="border-t border-foreground/8 py-5">
        <p className="text-[13px] font-medium text-muted-foreground">Access details are unavailable while this workspace is loading.</p>
      </div>
    </div>
  );
}

function PreferencesSettings({
  mode,
  resolvedMode,
  onThemeModeChange,
}: {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
}) {
  return (
    <div className="max-w-[44rem]">
      <SettingsSectionHeading title="Appearance" />
      <AppearanceControl mode={mode} resolvedMode={resolvedMode} onChange={onThemeModeChange} />
    </div>
  );
}

function AccountSettings({
  accountEmail,
  onUpdatePassword,
  onSignOut,
}: {
  accountEmail?: string;
  onUpdatePassword?: (input: { password: string }) => Promise<void>;
  onSignOut?: () => void;
}) {
  return (
    <div className="max-w-[52rem] border-t border-foreground/8">
      <AccountIdentity accountEmail={accountEmail} />
      {onUpdatePassword ? <PasswordSettings onUpdatePassword={onUpdatePassword} /> : null}
      {onSignOut ? (
        <section className="grid gap-4 border-b border-foreground/8 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-8">
          <h2 className="text-[12px] font-semibold text-foreground">Session</h2>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] font-medium text-muted-foreground">Sign out on this device.</p>
            <Button variant="ghost" onClick={onSignOut} leadingIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}>
              Sign out
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AccountIdentity({ accountEmail }: { accountEmail?: string }) {
  const displayEmail = accountEmail?.trim() || "Email unavailable";

  return (
    <section className="grid gap-4 border-b border-foreground/8 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
      <h2 className="pt-1 text-[12px] font-semibold text-foreground">Email</h2>
      <Field label="Email address" value={displayEmail} onChange={() => undefined} type="email" readOnly />
    </section>
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

  return (
    <section className="grid gap-4 border-b border-foreground/8 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
      <h2 className="pt-1 text-[12px] font-semibold text-foreground">Password</h2>
      <form className="grid min-w-0 gap-3 sm:grid-cols-2" onSubmit={submit}>
        <Field label="New password" value={password} onChange={setPassword} type="password" />
        <Field label="Confirm password" value={confirmation} onChange={setConfirmation} type="password" />
        {message ? <p className="text-[12px] font-semibold text-muted-foreground sm:col-span-2">{message}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" pending={pending}>Change password</Button>
        </div>
      </form>
    </section>
  );
}

function SettingsSectionHeading({ title }: { title: string }) {
  return <h2 className="mb-5 font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>;
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
  const status = mode === "system" ? `Following system · ${resolvedLabel}` : `${resolvedLabel} mode`;
  const options: Array<{ mode: ThemeMode; label: string; ariaLabel: string; icon: ReactNode }> = [
    { mode: "system", label: "System", ariaLabel: "Use system appearance", icon: <Monitor className="h-4 w-4" aria-hidden="true" /> },
    { mode: "light", label: "Light", ariaLabel: "Use light appearance", icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
    { mode: "dark", label: "Dark", ariaLabel: "Use dark appearance", icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
  ];

  return (
    <div className="border-t border-foreground/8">
      <div className="flex flex-col gap-4 border-b border-foreground/8 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{status}</p>
        <div className="grid min-w-0 grid-cols-3 rounded-[10px] bg-foreground/[0.045] p-1">
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
                  "inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-[8px] px-2 text-[11px] font-semibold transition-colors sm:gap-2 sm:px-3 sm:text-[12px]",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
