import { ArrowUp, Loader2 } from "lucide-react";
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "../lib/utils";
import "./desktop-premium.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const buttonSizeClass: Record<ButtonSize, string> = {
  sm: "min-h-8 rounded-[8px] px-3 text-[12px]",
  md: "min-h-10 rounded-[10px] px-4 text-[13px]",
  lg: "min-h-11 rounded-[11px] px-[18px] text-[13px]",
};

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-accent text-white shadow-[0_1px_1px_hsl(var(--foreground)/0.06)] hover:bg-brand-accent/92 active:bg-brand-accent/86",
  secondary:
    "border border-foreground/10 bg-background text-foreground hover:border-foreground/16 hover:bg-foreground/[0.035] active:bg-foreground/[0.055]",
  ghost:
    "border border-transparent bg-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground active:bg-foreground/[0.065]",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/92 active:bg-destructive/86",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pending?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}>(function Button({
  className,
  children,
  variant = "primary",
  size = "md",
  pending = false,
  disabled,
  leadingIcon,
  trailingIcon,
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      {...props}
      data-variant={variant}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "os-action-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-ui font-semibold leading-none outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-brand-accent/28 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-42",
        buttonSizeClass[size],
        buttonVariantClass[variant],
        className,
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : leadingIcon}
      <span className="min-w-0">{children}</span>
      {!pending ? trailingIcon : null}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  pending?: boolean;
}>(function IconButton({
  label,
  children,
  variant = "ghost",
  size = "md",
  pending = false,
  disabled,
  className,
  ...props
}, ref) {
  const dimensions = size === "sm" ? "h-8 w-8 rounded-[8px]" : size === "lg" ? "h-11 w-11 rounded-[11px]" : "h-10 w-10 rounded-[10px]";
  return (
    <button
      ref={ref}
      type="button"
      data-variant={variant}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      {...props}
      className={cn(
        "os-action-button inline-flex shrink-0 items-center justify-center outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-brand-accent/28 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-42",
        dimensions,
        buttonVariantClass[variant],
        className,
      )}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : children}
    </button>
  );
});

export function Surface({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-foreground/9 bg-background",
        interactive && "transition-colors duration-150 hover:border-foreground/14 hover:bg-foreground/[0.018]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DesktopRow({
  children,
  meta,
  trailing,
  leading,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 lg:gap-x-6",
        leading && "sm:grid-cols-[auto_minmax(0,1fr)_auto]",
        className,
      )}
    >
      {leading ? <div className="row-span-2 hidden shrink-0 sm:block">{leading}</div> : null}
      <div className="min-w-0">{children}</div>
      {(meta || trailing) ? (
        <div className="flex shrink-0 items-center justify-end gap-3 text-right text-[12px] font-medium text-muted-foreground">
          {meta}
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export function DetailHeader({
  back,
  title,
  meta,
  className,
}: {
  back?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("min-w-0", className)}>
      {back ? <div className="mb-5">{back}</div> : null}
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-8">
        <h1 className="max-w-[28ch] break-words font-display text-[30px] font-semibold leading-[1.08] tracking-[-0.032em] text-foreground sm:text-[34px] lg:text-[38px]">
          {title}
        </h1>
        {meta ? <div className="pt-1 text-[13px] font-semibold text-muted-foreground lg:text-right">{meta}</div> : null}
      </div>
    </header>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-[8px] bg-foreground/[0.065] motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export function SkeletonRows({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("divide-y divide-foreground/8 border-y border-foreground/8", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-4">
          <div className="min-w-0">
            <SkeletonBlock className="h-4 w-[min(72%,24rem)]" />
            <SkeletonBlock className="mt-2 h-3 w-[min(45%,14rem)]" />
          </div>
          <SkeletonBlock className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export type TimestampContext = "standalone" | "grouped" | "rail" | "activity";

export function formatProductTimestamp(value: string, context: TimestampContext = "standalone", now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const delta = now.getTime() - date.getTime();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, context === "grouped"
    ? { hour: "numeric", minute: "2-digit", second: "2-digit" }
    : { hour: "numeric", minute: "2-digit" }).format(date);

  if (context === "grouped") return time;
  if (context === "activity") {
    if (delta >= 0 && delta < 60_000) return "Just now";
    if (dayDiff === 0) return time;
    if (dayDiff === 1) return `Yesterday, ${time}`;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
      hour: "numeric",
      minute: "2-digit",
  }).format(date);
  }
  if (delta >= 0 && delta < 60_000) return "Just now";
  if (context === "rail") {
    if (dayDiff === 0) return time;
    if (dayDiff === 1) return "Yesterday";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function Timestamp({
  value,
  context = "standalone",
  className,
}: {
  value: string;
  context?: TimestampContext;
  className?: string;
}) {
  return (
    <time dateTime={value} className={cn("whitespace-nowrap text-[12px] font-medium text-muted-foreground", className)}>
      {formatProductTimestamp(value, context)}
    </time>
  );
}

type ManagerComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  pending?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  textareaProps?: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "placeholder">;
};

export function ManagerComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "What do you want to work on?",
  pending = false,
  disabled = false,
  ariaLabel = "Work with Manager",
  className,
  textareaProps,
}: ManagerComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSubmit = Boolean(value.trim()) && !pending && !disabled;
  const {
    onKeyDown: externalOnKeyDown,
    className: textareaClassName,
    style: textareaStyle,
    ...restTextareaProps
  } = textareaProps ?? {};

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 24), 160)}px`;
  }, [value]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSubmit) onSubmit();
  }

  return (
    <form
      aria-label={ariaLabel}
      onSubmit={submit}
      className={cn(
        "os-manager-composer flex w-full min-w-0 items-end gap-3 rounded-[14px] border border-foreground/10 bg-foreground/[0.018] p-2.5 pl-4 shadow-[0_1px_0_hsl(var(--foreground)/0.02)] transition-[border-color,background-color,box-shadow] duration-150 focus-within:border-brand-accent/35 focus-within:bg-background focus-within:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.055)]",
        className,
      )}
    >
      <textarea
        {...restTextareaProps}
        ref={textareaRef}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          externalOnKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSubmit) onSubmit();
          }
        }}
        className={cn(
          "min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-[15px] font-medium leading-[1.5] text-foreground outline-none placeholder:text-muted-foreground/58 disabled:cursor-not-allowed disabled:opacity-55",
          textareaClassName,
        )}
        style={{ maxHeight: 160, overflowY: "auto", ...textareaStyle }}
      />
      <IconButton
        type="submit"
        label="Send to Manager"
        variant="primary"
        size="md"
        pending={pending}
        disabled={!canSubmit}
        className="mb-0 rounded-[11px]"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </form>
  );
}
