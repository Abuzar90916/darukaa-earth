import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  LayoutGrid,
  Loader2,
  LogOut,
  Map,
  Menu,
  FolderOpen,
  X,
} from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { performSignOut } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  { to: "/map", label: "Map", icon: Map },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({
  children,
  fullBleed = false,
}: {
  children: ReactNode;
  fullBleed?: boolean;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performSignOut({ queryClient, signOut });
      toast.success("You're signed out.");
      navigate({ to: "/login", replace: true });
    } catch {
      setSigningOut(false);
      toast.error("We couldn't sign you out. Please try again.");
    }
  }

  const name = (user?.user_metadata?.["name"] as string | undefined) ?? user?.email ?? "Account";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="relative min-h-[100svh] space-backdrop">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <GlassPanel
          as="nav"
          tone="strong"
          aria-label="Primary"
          className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
        >
          <Link
            to="/dashboard"
            className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark size="sm" />
          </Link>

          <ul className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-primary/12 text-foreground"
                        : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon aria-hidden className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-2 py-1.5 text-xs text-foreground transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-[0.625rem] font-semibold text-primary-foreground">
                  {initials}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:block">{name}</span>
              </button>

              {menuOpen ? (
                <GlassPanel
                  tone="strong"
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] w-56 p-2"
                >
                  <p className="px-2 py-1.5 text-xs text-subtle-foreground">
                    <span className="block truncate text-foreground">{name}</span>
                    <span className="mt-0.5 block truncate">{user?.email}</span>
                  </p>
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-70"
                  >
                    {signingOut ? (
                      <>
                        <Loader2 aria-hidden className="size-4 animate-spin" /> Signing out…
                      </>
                    ) : (
                      <>
                        <LogOut aria-hidden className="size-4" /> Sign out
                      </>
                    )}
                  </button>
                </GlassPanel>
              ) : null}
            </div>

            <Button
              variant="quiet"
              size="icon-sm"
              className="lg:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? (
                <X aria-hidden className="size-4" />
              ) : (
                <Menu aria-hidden className="size-4" />
              )}
            </Button>
          </div>
        </GlassPanel>

        {mobileOpen ? (
          <GlassPanel tone="strong" className="mt-2 p-2 lg:hidden">
            <ul className="grid gap-1">
              {NAV.map((item) => {
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                        active
                          ? "bg-primary/12 text-foreground"
                          : "text-muted-foreground hover:bg-surface/60",
                      )}
                    >
                      <item.icon aria-hidden className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="my-1.5 h-px bg-border" />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface/60 hover:text-foreground disabled:opacity-70"
            >
              {signingOut ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" /> Signing out…
                </>
              ) : (
                <>
                  <LogOut aria-hidden className="size-4" /> Sign out
                </>
              )}
            </button>
          </GlassPanel>
        ) : null}
      </header>

      <main
        className={cn(
          fullBleed
            ? "px-3 pb-3 pt-3 sm:px-5 sm:pb-5"
            : "mx-auto w-full max-w-[84rem] px-4 pb-16 pt-6 sm:px-6",
        )}
      >
        {children}
      </main>
    </div>
  );
}
