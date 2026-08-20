import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bell, ClipboardCheck, House, Library, LogOut, MessageCircle, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import type { CleanProductionView } from "../types/cleanProduction";
import { Button } from "./desktopPrimitives";

export function BrandMark({
  size = "md",
  testId,
  className,
}: {
  size?: "sm" | "md" | "lg";
  testId?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-foreground/10 bg-[#111]",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        size === "lg" && "h-12 w-12 rounded-[14px]",
        className,
      )}
    >
      <img src="/logo.png" alt="" className="h-full w-full object-cover" />
    </span>
  );
}

export function Badge({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors duration-150",
        active ? "border-brand-accent/20 bg-brand-ghost text-brand-accent" : "border-foreground/10 bg-background text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function ProductButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      variant={variant === "quiet" ? "ghost" : variant}
      size="md"
    >
      {children}
    </Button>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
  disabled,
  readOnly,
  helper,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  helper?: string;
  error?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div
      className={cn(
        "group rounded-[12px] border bg-background p-3 transition-[border-color,background-color,box-shadow] duration-150 focus-within:border-brand-accent/45 focus-within:ring-2 focus-within:ring-brand-accent/5",
        error ? "border-destructive/45 bg-destructive/[0.025]" : "border-foreground/8",
        disabled && "opacity-60",
      )}
    >
      <label htmlFor={id} className="font-ui block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/85 transition-colors group-focus-within:text-brand-accent">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "mt-1.5 w-full bg-transparent text-[14px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60",
          readOnly && "cursor-default",
        )}
      />
      {error || helper ? <p className={cn("mt-1.5 text-[12px] font-medium", error ? "text-destructive" : "text-muted-foreground/80")}>{error ?? helper}</p> : null}
    </div>
  );
}

export function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="group rounded-[12px] border border-brand-accent/15 bg-brand-accent/[0.025] p-3 transition-[border-color,box-shadow] duration-150 focus-within:border-brand-accent/45 focus-within:ring-2 focus-within:ring-brand-accent/5 sm:col-span-2">
      <label htmlFor={id} className="font-ui block text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-accent">
        {label}
      </label>
      <textarea
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[76px] w-full resize-none rounded-[10px] border border-foreground/8 bg-background/75 p-3 text-[14px] font-medium leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-brand-accent/35"
      />
    </div>
  );
}

export function WorkspaceHeader({
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid={`workspace-header-${title}`}
      className="mb-4 hidden flex-col gap-3 lg:mb-6 lg:flex lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.25rem] lg:text-[2.25rem]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function WorkspaceTabRail<T extends string>({
  items,
  active,
  onChange,
  ariaLabel,
  testId,
  className,
  semanticTabs = false,
  idPrefix,
}: {
  items: ReadonlyArray<{ id: T; label: string; badge?: string | null }>;
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  testId?: string;
  className?: string;
  semanticTabs?: boolean;
  idPrefix?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn("workspace-tab-rail scrollbar-none grid auto-cols-fr grid-flow-col overflow-x-auto", className)}
    >
      {items.map((item) => {
        const selected = active === item.id;
        return (
          <button
            key={item.id}
            id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
            type="button"
            role={semanticTabs ? "tab" : undefined}
            aria-selected={semanticTabs ? selected : undefined}
            aria-pressed={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.id}` : undefined}
            onClick={() => onChange(item.id)}
            className={cn("workspace-tab", selected && "workspace-tab-active")}
          >
            <span>{item.label}</span>
            {item.badge ? <span className="workspace-tab-badge max-lg:hidden">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceShell({
  eyebrow,
  title,
  onBack,
  children,
  showBack = true,
  punctuateTitle = true,
  variant = "default",
  backLabel = "Back",
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
  children: ReactNode;
  showBack?: boolean;
  punctuateTitle?: boolean;
  variant?: "default" | "conversation";
  backLabel?: string;
}) {
  return (
    <div className="app-workspace app-workspace-reveal">
      <div className="os-room-rail">
      {showBack && variant === "conversation" ? (
        <div className="sticky top-0 z-30 -mx-3 mb-2 border-b border-foreground/8 bg-background/92 px-3 py-2.5 backdrop-blur-xl lg:-mx-4 lg:px-4">
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.045] hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/20"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <h1 className="min-w-0 truncate text-[14px] font-semibold text-foreground sm:text-[15px]">{title}</h1>
          </div>
        </div>
      ) : showBack ? (
        <div className="sticky top-0 z-30 -mx-3 mb-5 flex items-center justify-between border-b border-foreground/8 bg-background/95 px-3 py-2 backdrop-blur-sm lg:-mx-4 lg:px-4">
          <button
            type="button"
            onClick={onBack}
            className="group flex items-center gap-2 rounded-[10px] px-1 py-1 text-[13px] font-semibold text-muted-foreground/85 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/20"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-foreground/10 bg-background transition-colors group-hover:border-foreground/20 group-hover:bg-foreground/[0.03]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </div>
            Back
          </button>
        </div>
      ) : null}
      {variant === "default" ? <div className="mb-5 lg:mb-8">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display mt-1.5 max-w-[28ch] text-[1.55rem] font-semibold leading-[1.12] tracking-[-0.025em] text-foreground sm:text-[1.75rem] lg:text-[2rem]">{title}{punctuateTitle ? "." : ""}</h1>
      </div> : null}
      {children}
      </div>
    </div>
  );
}

const navItems: Array<{ label: string; active: NavSection; view: CleanProductionView; icon: LucideIcon }> = [
  { label: "Home", active: "labelHQ", view: "labelHQ", icon: House },
  { label: "Catalog", active: "music", view: "musicWorkspace", icon: Library },
  { label: "Manager", active: "manager", view: "managerOffice", icon: MessageCircle },
  { label: "Missions", active: "missions", view: "missionsWorkspace", icon: ClipboardCheck },
];

type NavSection = "labelHQ" | "music" | "manager" | "missions" | "settings";
type RecentManagerConversation = { id: string; topic: string };

export function sectionForView(view: CleanProductionView): NavSection {
  if (view === "musicWorkspace") return "music";
  if (
    view === "managerOffice" ||
    view === "conversationWorkspace" ||
    view === "investigation" ||
    view === "decisionPackage" ||
    view === "staffWorkspace" ||
    view === "lockedAgentWorkspace"
  ) return "manager";
  if (view === "missionsWorkspace") return "missions";
  if (view === "artistProfileWorkspace") return "settings";
  return "labelHQ";
}

export function DeskRail({
  active,
  onNavigate,
  onSignOut,
  activeMissionCount = 0,
  recentManagerConversations = [],
  onOpenManagerConversation,
}: {
  active: NavSection;
  onNavigate: (view: CleanProductionView) => void;
  onSignOut?: () => void;
  activeMissionCount?: number;
  recentManagerConversations?: RecentManagerConversation[];
  onOpenManagerConversation?: (conversationId: string) => void;
}) {
  return (
    <nav
      aria-label="Ordersounds Desk navigation"
      className="hidden min-w-0 flex-col justify-between overflow-y-auto border-r border-foreground/8 bg-background px-3 pb-4 pt-4 lg:sticky lg:top-0 lg:flex lg:h-screen"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2 pb-2 pt-1">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">Ordersounds</p>
            <p className="font-ui mt-0.5 text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground/68">Artist desk</p>
          </div>
        </div>
        <div className="h-px shrink-0 bg-foreground/7" />
        <div className="flex shrink-0 flex-col gap-1 py-0.5">
          {navItems.map((item) => item.active === "manager" ? (
            <div key={item.label} className="group">
              <NavButton item={item} active={active === item.active} onNavigate={onNavigate} activeMissionCount={activeMissionCount} />
              {recentManagerConversations.length ? (
                <div
                  data-testid="desktop-manager-recents"
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out",
                    active === "manager"
                      ? "mt-1 max-h-40 opacity-100"
                      : "max-h-0 opacity-0 group-hover:mt-1 group-hover:max-h-40 group-hover:opacity-100 group-focus-within:mt-1 group-focus-within:max-h-40 group-focus-within:opacity-100",
                  )}
                >
                  <div className="ml-7 border-l border-foreground/8 py-1 pl-2">
                    <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/55">Recent</p>
                    {recentManagerConversations.slice(0, 3).map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        aria-label={`Open Manager conversation ${conversation.topic}`}
                        onClick={() => onOpenManagerConversation?.(conversation.id)}
                        className="block w-full truncate rounded-[8px] px-2 py-1.5 text-left text-[12px] font-medium text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/25"
                      >
                        {conversation.topic}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <NavButton key={item.label} item={item} active={active === item.active} onNavigate={onNavigate} activeMissionCount={activeMissionCount} />
          ))}
        </div>
      </div>
      <div className="mt-4 shrink-0">
        <div className="mb-2 h-px bg-foreground/7" />
        <button
          type="button"
          onClick={() => onNavigate("artistProfileWorkspace")}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-accent/20",
            active === "settings" ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
          )}
        >
          <Settings className={cn("h-[15px] w-[15px] shrink-0", active === "settings" ? "text-brand-accent" : "text-current opacity-62")} aria-hidden="true" />
          Settings
        </button>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-0.5 flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/20"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-62" aria-hidden="true" />
            Sign out
          </button>
        ) : null}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  onNavigate,
  activeMissionCount,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onNavigate: (view: CleanProductionView) => void;
  activeMissionCount: number;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-label={item.label === "Catalog" ? "Open Catalog workspace" : item.label === "Manager" ? "Open Manager" : item.label}
      onClick={() => onNavigate(item.view)}
      className={cn(
        "relative flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 font-ui text-[12px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand-accent/20",
        active ? "bg-foreground/[0.06] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-brand-accent" : "text-current opacity-62")} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
      {active ? <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" /> : null}
      {item.active === "missions" && activeMissionCount > 0 ? (
        <span data-testid="desktop-mission-count" className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.06] px-1.5 text-[11px] font-semibold text-foreground">{formatNavigationCount(activeMissionCount)}</span>
      ) : null}
    </button>
  );
}

export function MobileChrome({
  active,
  title,
  onNavigate,
  notificationCount = 0,
  onOpenNotifications,
  activeMissionCount = 0,
  avatarUrl,
  showTopbar = true,
  showTabbar = true,
}: {
  active: NavSection;
  title: string;
  onNavigate: (view: CleanProductionView) => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  activeMissionCount?: number;
  avatarUrl?: string;
  showTopbar?: boolean;
  showTabbar?: boolean;
}) {
  return (
    <>
      {showTopbar ? (
        <header
          data-testid="mobile-app-topbar"
          className="sticky top-0 z-40 -mx-3 mb-3 flex min-h-[64px] items-center justify-between border-b border-foreground/8 bg-background/94 px-3 py-2.5 backdrop-blur-xl lg:hidden"
        >
          <div className="min-w-0">
            <p className="font-ui truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/62">
              {active === "settings" ? "Account" : "Artist workspace"}
            </p>
            <p className="font-display mt-1 truncate text-[19px] font-semibold leading-none tracking-[-0.025em] text-foreground">{title}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenNotifications ? (
              <button
                type="button"
                data-testid="mobile-notification-trigger"
                aria-label={notificationCount ? `Open Activity Center, ${notificationCount} unread` : "Open Activity Center"}
                onClick={onOpenNotifications}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {notificationCount ? (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold leading-none text-background ring-2 ring-background">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="mobile-account-trigger"
              aria-label="Open artist settings"
              onClick={() => onNavigate("artistProfileWorkspace")}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-foreground/8 bg-foreground/[0.02] text-muted-foreground transition-colors hover:border-foreground/14 hover:bg-foreground/[0.05] hover:text-foreground",
                active === "settings" && "border-brand-accent/25 bg-brand-accent/[0.06] text-brand-accent",
              )}
            >
              <UserRound className="h-[16px] w-[16px]" aria-hidden="true" />
              {avatarUrl ? (
                <img
                  data-testid="mobile-account-avatar"
                  src={avatarUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                />
              ) : null}
            </button>
          </div>
        </header>
      ) : null}
      {showTabbar ? (
        <nav
          data-testid="mobile-tabbar"
          aria-label="Mobile desk navigation"
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-foreground/8 bg-background/94 px-2 pt-1 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "calc(0.35rem + env(safe-area-inset-bottom))" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const label = item.label;
            const selected = active === item.active;
            return (
              <button
                key={item.label}
                type="button"
                data-testid={`mobile-tab-${label}`}
                aria-current={selected ? "page" : undefined}
                onClick={() => onNavigate(item.view)}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2 text-[10px] font-semibold transition-colors",
                  selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span aria-hidden="true" className={cn("absolute left-1/2 top-0 h-[2px] w-6 -translate-x-1/2 rounded-full bg-brand-accent transition-opacity", selected ? "opacity-100" : "opacity-0")} />
                <span className="relative">
                  <Icon className={cn("h-[16px] w-[16px]", selected ? "text-brand-accent" : "opacity-70")} aria-hidden="true" />
                  {item.active === "missions" && activeMissionCount > 0 ? (
                    <span data-testid="mobile-mission-count" className="absolute -right-3 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[9px] font-bold text-background ring-2 ring-background">{formatNavigationCount(activeMissionCount)}</span>
                  ) : null}
                </span>
                <span data-testid={`mobile-tab-label-${label}`} className="max-w-full truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}

function formatNavigationCount(count: number) {
  return count > 9 ? "9+" : String(count);
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-[0.04em]",
        tone === "neutral" && "border-foreground/10 bg-background text-muted-foreground",
        tone === "success" && "border-success/20 bg-success/10 text-success",
        tone === "warning" && "border-warning/20 bg-warning/10 text-warning",
      )}
    >
      {children}
    </span>
  );
}
