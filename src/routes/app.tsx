import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ensureProfileFromUser } from "@/features/profile/api";

export const Route = createFileRoute("/app")({
  beforeLoad: async ({ context, location }) => {
    const {
      data: { user },
    } = await context.supabase.auth.getUser();

    if (!user) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }

    await ensureProfileFromUser(context.supabase, user);
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
