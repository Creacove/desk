import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bell, ClipboardCheck, Gauge, Library, LogOut, Settings, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import type { CleanProductionView } from "../types/cleanProduction";

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
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em] transition-colors duration-200",
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
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-ui text-[12px] font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-foreground text-background hover:bg-foreground/90",
        variant === "secondary" && "border border-foreground/10 bg-background text-foreground hover:border-foreground/20 hover:bg-foreground/[0.03]",
        variant === "quiet" && "border border-transparent bg-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {children}
    </button>
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
  helper?: string;
  error?: string;
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div
      className={cn(
        "group rounded-[12px] border bg-background p-2.5 transition-all duration-300 focus-within:border-brand-accent/50 focus-within:ring-2 focus-within:ring-brand-accent/5",
        error ? "border-destructive/45 bg-destructive/[0.025]" : "border-foreground/8",
        disabled && "opacity-60",
      )}
    >
      <label htmlFor={id} className="font-ui block text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/85 transition-colors group-focus-within:text-brand-accent">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-transparent text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
      />
      {error || helper ? <p className={cn("mt-1.5 text-[11px] font-semibold", error ? "text-destructive" : "text-muted-foreground/80")}>{error ?? helper}</p> : null}
    </div>
  );
}

export function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="group rounded-[12px] border border-brand-accent/15 bg-brand-accent/[0.025] p-3 transition-all duration-300 focus-within:border-brand-accent/45 focus-within:ring-2 focus-within:ring-brand-accent/5 sm:col-span-2">
      <label htmlFor={id} className="font-ui block text-[9px] font-bold uppercase tracking-[0.12em] text-brand-accent">
        {label}
      </label>
      <textarea
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[70px] w-full resize-none rounded-[10px] border border-foreground/8 bg-background/75 p-3 text-[13px] font-semibold leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/85"
      />
    </div>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid={`workspace-header-${title}`}
      className="mb-4 hidden flex-col gap-3 lg:mb-5 lg:flex lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display mt-1.5 text-[2rem] font-semibold leading-none text-foreground sm:text-[2.25rem] lg:text-[2.5rem]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function WorkspaceShell({
  eyebrow,
  title,
  onBack,
  children,
  showBack = true,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
  children: ReactNode;
  showBack?: boolean;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {showBack ? (
        <div className="sticky top-[61px] z-30 -mx-3 mb-5 flex items-center justify-between border-b border-foreground/8 bg-background px-3 py-2 lg:static lg:mx-0 lg:mb-6 lg:border-0 lg:bg-transparent lg:p-0">
          <button
            type="button"
            onClick={onBack}
            className="group flex items-center gap-2 text-[13px] font-semibold text-muted-foreground/85 transition-colors hover:text-foreground"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-foreground/10 bg-background transition-colors group-hover:border-foreground/20 group-hover:bg-foreground/[0.03]">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </div>
            Back
          </button>
        </div>
      ) : null}
      <div className="mb-5 lg:mb-8">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{eyebrow}</p>
        <h1 className="font-display mt-1.5 text-[1.45rem] font-semibold leading-tight text-foreground sm:text-[1.7rem]">{title}.</h1>
      </div>
      {children}
    </div>
  );
}

const navItems: Array<{ label: string; active: NavSection; view: CleanProductionView; icon: LucideIcon }> = [
  { label: "Desk HQ", active: "labelHQ", view: "labelHQ", icon: Gauge },
  { label: "Music", active: "music", view: "musicWorkspace", icon: Library },
  { label: "Team Agents", active: "staff", view: "staffWorkspace", icon: UsersRound },
  { label: "Missions", active: "missions", view: "missionsWorkspace", icon: ClipboardCheck },
];

type NavSection = "labelHQ" | "music" | "staff" | "missions" | "settings";

export function sectionForView(view: CleanProductionView): NavSection {
  if (view === "musicWorkspace") return "music";
  if (view === "staffWorkspace" || view === "lockedAgentWorkspace") return "staff";
  if (view === "missionsWorkspace") return "missions";
  if (view === "artistProfileWorkspace") return "settings";
  return "labelHQ";
}

export function DeskRail({
  active,
  onNavigate,
  onSignOut,
}: {
  active: NavSection;
  onNavigate: (view: CleanProductionView) => void;
  onSignOut?: () => void;
}) {
  return (
    <nav
      aria-label="Ordersounds Desk navigation"
      className="hidden min-w-0 flex-col justify-between overflow-y-auto border-r border-foreground/10 bg-background p-3 lg:sticky lg:top-0 lg:flex lg:h-screen"
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display truncate text-[14px] font-semibold text-foreground">Ordersounds</p>
            <p className="font-ui text-[9px] font-semibold uppercase tracking-[0.04em] text-muted-foreground opacity-70">ARTIST OPERATING DESK</p>
          </div>
        </div>
        <div className="mx-2 h-px shrink-0 bg-foreground/8" />
        <div className="flex shrink-0 flex-col gap-0.5 py-1">
          {navItems.map((item) => (
            <NavButton key={item.label} item={item} active={active === item.active} onNavigate={onNavigate} />
          ))}
        </div>
      </div>
      <div className="mt-4 shrink-0">
        <div className="mx-2 mb-2 h-px bg-foreground/8" />
        <button
          type="button"
          onClick={() => onNavigate("artistProfileWorkspace")}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 font-ui text-[13px] font-semibold transition-colors duration-200",
            active === "settings" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <Settings className={cn("h-[15px] w-[15px] shrink-0", active === "settings" ? "text-brand-accent" : "text-current opacity-60")} aria-hidden="true" />
          Settings
        </button>
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 font-ui text-[13px] font-semibold text-muted-foreground transition-colors duration-200 hover:bg-foreground/5 hover:text-foreground"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0 opacity-60" aria-hidden="true" />
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
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onNavigate: (view: CleanProductionView) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-label={item.label === "Music" ? "Open Music workspace" : undefined}
      onClick={() => onNavigate(item.view)}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 font-ui text-[13px] font-semibold transition-colors duration-200",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-brand-accent" : "text-current opacity-60")} aria-hidden="true" />
      {item.label}
    </button>
  );
}

export function MobileChrome({
  active,
  title,
  onNavigate,
  notificationCount = 0,
  onOpenNotifications,
}: {
  active: NavSection;
  title: string;
  onNavigate: (view: CleanProductionView) => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}) {
  return (
    <>
      <header
        data-testid="mobile-app-topbar"
        className="sticky top-0 z-40 -mx-3 mb-4 flex items-center justify-between border-b border-foreground/10 bg-background px-3 py-2.5 lg:hidden"
      >
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display truncate text-[14px] font-semibold text-foreground">Ordersounds</p>
            <p className="font-ui truncate text-[9px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/80">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onOpenNotifications ? (
            <button
              type="button"
              data-testid="mobile-notification-trigger"
              aria-label="Open desk notifications"
              onClick={onOpenNotifications}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-background text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {notificationCount ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold leading-none text-background">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => onNavigate("artistProfileWorkspace")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-background text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
              active === "settings" && "border-foreground/20 bg-foreground text-background",
            )}
          >
            <Settings className={cn("h-3.5 w-3.5", active === "settings" && "text-brand-accent")} aria-hidden="true" />
          </button>
        </div>
      </header>
      <nav
        aria-label="Mobile desk navigation"
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-xl border border-foreground/10 bg-background p-1.5 shadow-[0_8px_24px_rgba(17,19,24,0.08)] lg:hidden"
        style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.view)}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold transition-colors",
                active === item.active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
              )}
            >
              <Icon className={cn("h-[15px] w-[15px]", active === item.active ? "text-brand-accent" : "opacity-65")} aria-hidden="true" />
              <span className="truncate">{item.active === "labelHQ" ? "HQ" : item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-[0.04em]",
        tone === "neutral" && "border-foreground/10 bg-background text-muted-foreground",
        tone === "success" && "border-success/20 bg-success/10 text-success",
        tone === "warning" && "border-warning/20 bg-warning/10 text-warning",
      )}
    >
      {children}
    </span>
  );
}
