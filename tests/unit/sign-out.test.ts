import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { performSignOut } from "@/lib/sign-out";

describe("performSignOut", () => {
  it("cancels queries, clears the cache, then ends the session", async () => {
    const queryClient = new QueryClient();
    const order: string[] = [];
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockImplementation(async () => {
      order.push("cancel");
    });
    const clear = vi.spyOn(queryClient, "clear").mockImplementation(() => {
      order.push("clear");
    });
    const signOut = vi.fn(async () => {
      order.push("signOut");
    });

    await performSignOut({ queryClient, signOut });

    expect(cancel).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["cancel", "clear", "signOut"]);
  });

  it("propagates a failed backend sign-out so callers can surface an error", async () => {
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined);
    const signOut = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(performSignOut({ queryClient, signOut })).rejects.toThrow("network down");
  });

  it("removes cached protected data from the client", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["projects"], [{ id: "p1" }]);
    const signOut = vi.fn(async () => {});

    await performSignOut({ queryClient, signOut });

    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
  });
});
