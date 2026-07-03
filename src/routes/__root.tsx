import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import type { Database } from "@/lib/supabase/database.types";

export type RouterContext = {
  queryClient: QueryClient;
  supabase: SupabaseClient<Database>;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        title: "club.study",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <>
      <HeadContent />
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
}
