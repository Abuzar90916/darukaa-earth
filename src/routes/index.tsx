import { createFileRoute } from "@tanstack/react-router";

import { AuthScreen } from "@/features/auth/AuthScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Darukaa.Earth — Earth Intelligence Platform" },
      {
        name: "description",
        content:
          "Understand the Earth. Measure change. Protect what matters. Manage carbon and biodiversity projects through spatial intelligence.",
      },
      { property: "og:title", content: "Darukaa.Earth — Earth Intelligence Platform" },
      { property: "og:type", content: "website" },
      {
        property: "og:description",
        content:
          "A geospatial analytics platform for carbon and biodiversity projects: map sites, measure change, track performance over time.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthScreen,
});
