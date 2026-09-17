/**
 * Shared sign-out routine.
 *
 * Cancels in-flight queries, drops every cached row of protected data, then
 * terminates the backend session. Callers own the redirect so the router (not
 * the browser) performs a history REPLACE to /login.
 */
import type { QueryClient } from "@tanstack/react-query";

export interface SignOutDeps {
  queryClient: QueryClient;
  signOut: () => Promise<void>;
}

export async function performSignOut({ queryClient, signOut }: SignOutDeps): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.clear();
  await signOut();
}
