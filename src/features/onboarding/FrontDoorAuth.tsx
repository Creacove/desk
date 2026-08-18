import { Check, LoaderCircle, LogOut } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { BrandMark, Field, ProductButton } from "../../design-system/components";
import { identifyAnalyticsUser, isTestUserEmail, trackEvent } from "../../lib/analytics";
import type { ProductionAuthAdapter } from "../../types/productionApp";

type PaymentReturnState = {
  reference: string;
  status: "checking" | "waiting" | "ready" | "mismatch" | "error" | "timed-out";
  message?: string;
};

export function FrontDoorAuthScreen({
  authAdapter,
  onAuthenticated,
}: {
  authAdapter: ProductionAuthAdapter;
  onAuthenticated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authAdapter.requestPasswordReset) {
      setMessage("Couldn’t send a recovery link. Try again.");
      return;
    }
    try {
      setPending(true);
      setMessage(null);
      await authAdapter.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/update-password` });
      setMessage("If that email belongs to an account, a recovery link is on its way.");
    } catch {
      setMessage("Couldn’t send a recovery link. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const handler = isSignUp ? authAdapter.signUpWithPassword : authAdapter.signInWithPassword;
      if (!handler) {
        setMessage("Couldn’t continue right now. Try again.");
        return;
      }
      const result = await handler({ email: email.trim(), password });
      setMessage(result.message ?? null);
      if (result.user) {
        if (isSignUp) {
          identifyAnalyticsUser(result.user);
          trackEvent("user signed up", {
            signup_method: "email",
            is_test_user: isTestUserEmail(result.user.email),
          });
        }
        await onAuthenticated();
      }
    } catch {
      setMessage(isSignUp ? "Couldn’t create the account. Try again." : "Couldn’t sign in. Check your details and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <FrontDoorAuthFrame>
      <section className="w-full max-w-[27rem]">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <BrandMark size="sm" testId="auth-brand-logo" />
          <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">Desk</span>
        </div>

        {mode === "forgot" ? (
          <>
            <h1 className="font-display text-[32px] font-semibold leading-[1] tracking-[-0.035em] text-foreground">Reset your password</h1>
            <p className="mt-3 text-[13px] font-medium text-muted-foreground/72">We’ll send a recovery link to your email.</p>
            <form className="mt-8 space-y-4" onSubmit={handleForgotPassword}>
              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required disabled={pending} />
              {message ? <AuthMessage>{message}</AuthMessage> : null}
              <ProductButton type="submit" disabled={pending}>{pending ? "Sending link" : "Send recovery link"}</ProductButton>
            </form>
            <button
              type="button"
              onClick={() => { setMode("sign-in"); setMessage(null); }}
              className="mt-5 text-[12px] font-semibold text-muted-foreground underline decoration-foreground/20 underline-offset-4 hover:text-foreground"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-[32px] font-semibold leading-[1] tracking-[-0.035em] text-foreground">
              {isSignUp ? "Create your Desk." : "Welcome back."}
            </h1>
            {isSignUp ? <p className="mt-3 text-[13px] font-medium text-muted-foreground/72">Start with your artist.</p> : null}

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required disabled={pending} />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                required
                disabled={pending}
              />
              {!isSignUp ? (
                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setMessage(null); }}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}
              {message ? <AuthMessage>{message}</AuthMessage> : null}
              <ProductButton type="submit" disabled={pending}>
                {pending ? (isSignUp ? "Creating account" : "Signing in") : isSignUp ? "Create account" : "Sign in"}
              </ProductButton>
            </form>

            <p className="mt-6 text-[12px] font-medium text-muted-foreground">
              {isSignUp ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                disabled={pending}
                onClick={() => { setMode(isSignUp ? "sign-in" : "sign-up"); setMessage(null); }}
                className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-4 hover:decoration-foreground/50 disabled:opacity-50"
              >
                {isSignUp ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        )}
      </section>
    </FrontDoorAuthFrame>
  );
}

export function FrontDoorPaymentReturnScreen({
  state,
  onRetry,
  onSignOut,
}: {
  state: PaymentReturnState;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  const copy = paymentReturnCopy(state.status);
  return (
    <FrontDoorAuthFrame onSignOut={onSignOut}>
      <section className="w-full max-w-[27rem]" aria-live="polite">
        <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-[12px] bg-foreground/[0.05] text-foreground">
          {state.status === "ready" ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : state.status === "checking" || state.status === "waiting" || state.status === "timed-out" ? (
            <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <BrandMark size="sm" />
          )}
        </div>
        <h1 className="font-display text-[32px] font-semibold leading-[1] tracking-[-0.035em] text-foreground">{copy.title}</h1>
        <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed text-muted-foreground/72">{copy.body}</p>
        {onRetry ? <div className="mt-7"><ProductButton onClick={onRetry}>Check again</ProductButton></div> : null}
      </section>
    </FrontDoorAuthFrame>
  );
}

export function FrontDoorTransitionScreen({ title = "Opening Desk" }: { title?: string; body?: string; steps?: string[]; logoTestId?: string }) {
  return (
    <main data-testid="front-door-transition" className="app-theme flex min-h-dvh items-center justify-center bg-background px-5 text-foreground" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <BrandMark size="md" />
        <p className="mt-5 text-[12px] font-semibold text-muted-foreground">{title}</p>
        <span className="mt-4 h-1.5 w-1.5 rounded-full bg-brand-accent motion-safe:animate-pulse" aria-hidden="true" />
      </div>
    </main>
  );
}

export function FrontDoorMessageScreen({
  title,
  body,
  action,
}: {
  title: string;
  body?: string | null;
  action?: ReactNode;
}) {
  return (
    <FrontDoorAuthFrame>
      <section className="w-full max-w-[27rem]">
        <h1 className="font-display text-[32px] font-semibold leading-[1] tracking-[-0.035em] text-foreground">{title}</h1>
        {body ? <p className="mt-3 text-[13px] font-medium leading-relaxed text-muted-foreground/72">{body}</p> : null}
        {action ? <div className="mt-7">{action}</div> : null}
      </section>
    </FrontDoorAuthFrame>
  );
}

function FrontDoorAuthFrame({ children, onSignOut }: { children: ReactNode; onSignOut?: () => void }) {
  return (
    <main data-testid="auth-shell" className="app-theme min-h-dvh overflow-x-hidden bg-background px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[72rem] flex-col">
        <header className="flex min-h-11 items-center justify-between">
          <div className="hidden items-center gap-2.5 lg:flex">
            <BrandMark size="sm" />
            <span className="font-display text-[17px] font-semibold tracking-[-0.025em]">Desk</span>
          </div>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="ml-auto inline-flex min-h-10 items-center gap-2 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </header>

        <div className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.68fr)] lg:gap-20">
          <aside className="hidden lg:block">
            <h2 className="max-w-[10ch] font-display text-[48px] font-semibold leading-[0.96] tracking-[-0.04em] text-foreground">Know what to do next.</h2>
          </aside>
          <div className="w-full">{children}</div>
        </div>
      </div>
    </main>
  );
}

function AuthMessage({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">{children}</p>;
}

function paymentReturnCopy(status: PaymentReturnState["status"]) {
  if (status === "mismatch") {
    return {
      title: "Sign in with the account that started this Desk",
      body: "This checkout belongs to a different account.",
    };
  }
  if (status === "waiting" || status === "timed-out" || status === "error") {
    return {
      title: "Still confirming",
      body: "Your payment is safe. You won’t be charged again.",
    };
  }
  return {
    title: "Opening your Desk",
    body: "Confirming your access.",
  };
}
