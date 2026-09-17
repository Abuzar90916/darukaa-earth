import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { AppShell } from "@/features/shell/AppShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "unauthenticated") navigate({ to: "/login", replace: true });
  }, [status, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-[100svh] place-items-center space-backdrop">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          Restoring your session…
        </p>
      </div>
    );
  }

  return (
    <AppShellSwitch>
      <Outlet />
    </AppShellSwitch>
  );
}

/** The map page needs edge-to-edge space; every other page is a contained page. */
function AppShellSwitch({ children }: { children: React.ReactNode }) {
  const isMap = typeof window !== "undefined" && window.location.pathname.startsWith("/map");
  return <AppShell fullBleed={isMap}>{children}</AppShell>;
}
