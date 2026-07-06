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
        <div className="px-4 py-6 md:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
