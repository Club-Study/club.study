import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ensureProfileFromUser } from "@/features/profile/api";
import { supabase } from "@/lib/supabase/client";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }

    await ensureProfileFromUser(user);
  },
  component: AppRoute,
});

function AppRoute() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 items-center border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <SidebarTrigger />
        </header>
        <div className="min-h-dvh px-5 py-8 md:px-10 md:py-12 lg:px-14">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
