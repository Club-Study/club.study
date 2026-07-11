import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  type ErrorComponentProps,
} from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/lib/user-facing-error";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export type RouterContext = {
  queryClient: QueryClient;
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
  errorComponent: RootError,
});

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center p-6">
      <section role="alert" className="w-full rounded-md border p-5">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {toUserMessage(error)}
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={reset}>
          Try again
        </Button>
      </section>
    </main>
  );
}

function RootDocument() {
  return (
    <>
      <HeadContent />
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
}
