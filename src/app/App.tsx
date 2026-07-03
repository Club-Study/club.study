import { RouterProvider } from "@tanstack/react-router";

import { AppProviders, queryClient } from "@/app/providers";
import { router } from "@/app/router";
import { supabase } from "@/lib/supabase/client";

export function App() {
  return (
    <AppProviders>
      <RouterProvider
        router={router}
        context={{
          queryClient,
          supabase,
        }}
      />
    </AppProviders>
  );
}
