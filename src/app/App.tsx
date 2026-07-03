import { RouterProvider } from "@tanstack/react-router";

import { AppProviders, queryClient } from "@/app/providers";
import { router } from "@/app/router";

export function App() {
  return (
    <AppProviders>
      <RouterProvider
        router={router}
        context={{
          queryClient,
        }}
      />
    </AppProviders>
  );
}
