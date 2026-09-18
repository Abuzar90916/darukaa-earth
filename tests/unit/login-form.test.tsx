import { render } from "@testing-library/react";
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthScreen } from "@/features/auth/AuthScreen";

const { navigate, signIn, signUp, signInWithOAuth, auth } = vi.hoisted(() => {
  const signIn = vi.fn();
  const signUp = vi.fn();
  return {
    navigate: vi.fn(),
    signIn,
    signUp,
    signInWithOAuth: vi.fn(),
    auth: { status: "unauthenticated" as string, signIn, signUp },
  };
});

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  auth.status = "unauthenticated";
});

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Email"));
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  return user;
}

describe("login form validation", () => {
  it("rejects a malformed email before calling the backend", async () => {
    render(<AuthScreen />);
    const user = await fill("not-an-email", "supersecret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email address/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than six characters", async () => {
    render(<AuthScreen />);
    const user = await fill("ada@darukaa.earth", "123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 6 characters/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("requires a name when creating an account", async () => {
    render(<AuthScreen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create an account/i }));
    await user.type(screen.getByLabelText("Email"), "ada@darukaa.earth");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter your name/i);
    expect(signUp).not.toHaveBeenCalled();
  });
});

describe("sign-in behaviour", () => {
  it("submits trimmed credentials to the auth service", async () => {
    signIn.mockResolvedValue(undefined);
    render(<AuthScreen />);
    const user = await fill("ada@darukaa.earth", "supersecret");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledWith("ada@darukaa.earth", "supersecret"));
  });

  it("shows the auth error and stays on the form for invalid credentials", async () => {
    signIn.mockRejectedValue(new Error("That email and password don't match."));
    render(<AuthScreen />);
    const user = await fill("ada@darukaa.earth", "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/don't match/i);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("asks the user to confirm their email when sign-up needs confirmation", async () => {
    signUp.mockResolvedValue({ needsConfirmation: true });
    render(<AuthScreen />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /create an account/i }));
    await user.type(screen.getByLabelText("Full name"), "Ada Bhattacharya");
    await user.type(screen.getByLabelText("Email"), "ada@darukaa.earth");
    await user.type(screen.getByLabelText("Password"), "supersecret");
    await user.click(screen.getByRole("button", { name: /^create account$/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/confirm your email/i);
  });

  it("starts Google sign-in through the managed OAuth helper", async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    render(<AuthScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: /continue with google/i }));

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      }),
    );
  });

  it("reports a failed Google sign-in", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "denied" } });
    render(<AuthScreen />);
    await userEvent.setup().click(screen.getByRole("button", { name: /continue with google/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't sign you in with Google/i);
  });
});

describe("authenticated state handling", () => {
  it("redirects an already-authenticated visitor to the dashboard", async () => {
    auth.status = "authenticated";
    vi.useFakeTimers();
    render(<AuthScreen />);
    vi.advanceTimersByTime(700);
    vi.useRealTimers();

    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
  });
});
