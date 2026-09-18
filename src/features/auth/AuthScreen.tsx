import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

import loginBg from "@/assets/login-reference-wide.jpg";
import { BrandMark } from "@/components/BrandMark";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const { status, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [entering, setEntering] = useState(false);
  // Until React has hydrated, a click would submit the form natively (which would
  // put the password in the URL), so the submit button stays disabled.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (status === "authenticated") {
      setEntering(true);
      const t = window.setTimeout(() => navigate({ to: "/dashboard", replace: true }), 550);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [status, navigate]);

  async function onGoogleSignIn() {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setError("We couldn't sign you in with Google. Please try again.");
        setGoogleBusy(false);
        return;
      }
      // Redirected flows leave the page.
      return;
    } catch {
      setError("We couldn't sign you in with Google. Please try again.");
      setGoogleBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "signup" && name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(name, email, password);
        if (needsConfirmation) {
          setNotice("Check your inbox to confirm your email, then sign in.");
          setMode("signin");
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden">
      <div className="login-space-scene pointer-events-none fixed inset-0" aria-hidden>
        <img
          className="login-earth-video object-cover w-full h-full"
          src={loginBg}
          alt="Earth background"
        />
        <div className="login-earth-veil" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,oklch(0.07_0.02_264/0.38),transparent_46%),linear-gradient(180deg,oklch(0.05_0.02_264/0.12),transparent_68%)]"
      />

      <div
        className={cn(
          "relative z-10 flex min-h-[100svh] flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-14",
          "transition-all duration-500",
          entering && "scale-[1.02] opacity-0",
        )}
      >
        <header className="flex items-center justify-between">
          <BrandMark descriptor="Earth Intelligence Platform" />
          <span className="hidden text-xs text-subtle-foreground sm:block">
            Understand the Earth. Measure Change. Protect What Matters.
          </span>
        </header>

        <div className="flex flex-1 items-start justify-center pt-8 sm:items-center sm:pb-[22svh] sm:pt-0 lg:justify-start lg:pb-[18svh]">
          <GlassPanel
            tone="strong"
            className="w-full max-w-[26.5rem] p-6 sm:p-8 animate-rise lg:ml-[6vw]"
          >
            <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground sm:text-[2rem]">
              See the Earth differently.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Manage carbon and biodiversity projects through spatial intelligence.
            </p>

            <form
              onSubmit={onSubmit}
              method="post"
              data-hydrated={hydrated ? "true" : "false"}
              className="mt-7 space-y-4"
              noValidate
            >
              {mode === "signup" ? (
                <Field
                  id="name"
                  label="Full name"
                  icon={<User aria-hidden className="size-4" />}
                  value={name}
                  onChange={setName}
                  autoComplete="name"
                  placeholder="Ada Bhattacharya"
                />
              ) : null}

              <Field
                id="email"
                label="Email"
                type="email"
                icon={<Mail aria-hidden className="size-4" />}
                value={email}
                onChange={setEmail}
                autoComplete="email"
                placeholder="you@organisation.org"
              />

              <div>
                <label htmlFor="password" className="label-caps mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground">
                    <Lock aria-hidden className="size-4" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-lg border border-border bg-surface/50 pl-10 pr-11 text-sm text-foreground placeholder:text-subtle-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-subtle-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden className="size-4" />
                    ) : (
                      <Eye aria-hidden className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {mode === "signin" ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border-border bg-surface accent-primary"
                  />
                  Remember me on this device
                </label>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-foreground"
                >
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p
                  role="status"
                  className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground"
                >
                  {notice}
                </p>
              ) : null}

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={busy || !hydrated || status === "authenticated"}
              >
                {busy ? (
                  <>
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    {mode === "signup" ? "Creating account" : "Signing in"}
                  </>
                ) : (
                  <>
                    {mode === "signup" ? "Create account" : "Sign In"}
                    <ArrowRight aria-hidden className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="label-caps text-subtle-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-4 w-full"
              disabled={googleBusy || busy || status === "authenticated"}
              onClick={onGoogleSignIn}
            >
              {googleBusy ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : (
                <GoogleGlyph />
              )}
              Continue with Google
            </Button>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              {mode === "signin" ? "New to Darukaa.Earth?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setNotice(null);
                }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {mode === "signin" ? "Create an account" : "Sign in instead"}
              </button>
            </p>
          </GlassPanel>
        </div>

        <footer className="mt-8 text-center text-[0.6875rem] text-subtle-foreground sm:text-left">
          Demonstration dataset · carbon, biodiversity and combined project portfolios
        </footer>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-4">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.15 4.15 0 0 1-1.8 2.72l2.85 2.21c1.67-1.54 2.75-3.81 2.75-6.57z"
      />
      <path
        fill="#FBBC05"
        d="M3.87 10.78A5.5 5.5 0 0 1 3.58 9c0-.62.11-1.22.28-1.78L.96 4.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.91-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.95-2.18l-2.85-2.21c-.79.55-1.85.94-3.1.94-2.38 0-4.4-1.57-5.13-3.73L.96 13.04A8.99 8.99 0 0 0 9 18z"
      />
    </svg>
  );
}

function Field({
  id,
  label,
  icon,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="label-caps mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-border bg-surface/50 pl-10 pr-3 text-sm text-foreground placeholder:text-subtle-foreground focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
