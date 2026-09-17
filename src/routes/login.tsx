import { createFileRoute } from "@tanstack/react-router";

import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Darukaa.Earth" },
      {
        name: "description",
        content:
          "Sign in to Darukaa.Earth to manage carbon and biodiversity project sites, boundaries and measurements.",
      },
      { property: "og:title", content: "Sign in — Darukaa.Earth" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content: "Sign in with email or Google to access your Darukaa.Earth workspace.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});
