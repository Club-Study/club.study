import { createRouter } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultPendingMinMs: 150,
  context: {
    queryClient: undefined!,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
