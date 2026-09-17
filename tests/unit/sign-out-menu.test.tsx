import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/features/shell/AppShell";

const { navigate, signOut, toastSuccess, toastError } = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useRouterState: () => "/dashboard",
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { email: "ada@darukaa.earth", user_metadata: { name: "Ada Bhattacharya" } },
    signOut,
  }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

function renderShell() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["projects"], [{ id: "p1" }]);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <p>Dashboard content</p>
      </AppShell>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

beforeEach(() => vi.clearAllMocks());

describe("profile menu sign-out", () => {
  it("exposes Sign out inside the profile menu", async () => {
    renderShell();
    const user = userEvent.setup();
    expect(screen.queryByRole("menuitem", { name: /sign out/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Ada Bhattacharya/i }));

    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByText("ada@darukaa.earth")).toBeInTheDocument();
  });

  it("ends the session, clears cached data and redirects to /login", async () => {
    signOut.mockResolvedValue(undefined);
    const { queryClient } = renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Ada Bhattacharya/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith({ to: "/login", replace: true });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("shows a signing-out state while the session is being ended", async () => {
    let release: () => void = () => {};
    signOut.mockImplementation(() => new Promise<void>((resolve) => (release = resolve)));
    renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Ada Bhattacharya/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    expect(await screen.findByText(/signing out/i)).toBeInTheDocument();
    release();
  });

  it("reports an error and does not redirect when sign-out fails", async () => {
    signOut.mockRejectedValue(new Error("network down"));
    renderShell();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Ada Bhattacharya/i }));
    await user.click(screen.getByRole("menuitem", { name: /sign out/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });
});
