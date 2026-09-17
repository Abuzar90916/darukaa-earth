import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/lib/auth";

describe("authErrorMessage", () => {
  it("explains wrong credentials without leaking backend wording", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe(
      "That email and password don't match.",
    );
  });

  it("explains a duplicate account", () => {
    expect(authErrorMessage("User already registered")).toBe(
      "An account with this email already exists.",
    );
  });

  it("explains weak passwords", () => {
    expect(authErrorMessage("Password should be at least 6 characters")).toMatch(/6 characters/);
  });

  it("explains malformed email addresses", () => {
    expect(authErrorMessage("Unable to validate email address")).toMatch(/valid email/i);
  });

  it("falls back to a calm generic message", () => {
    expect(authErrorMessage("503 upstream failure")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
