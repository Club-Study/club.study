import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  HomeIcon,
  LibraryIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/features/auth/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Feed",
    to: "/app",
    icon: HomeIcon,
  },
  {
    label: "Clubs",
    to: "/app/clubs",
    icon: LibraryIcon,
  },
  {
    label: "Profile",
    to: "/app/profile",
    icon: UserIcon,
  },
] as const;

export function AppSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/app" className="flex min-w-0 items-center">
          <span className="truncate text-sm font-semibold group-data-[state=collapsed]/sidebar:hidden">
            club.study
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[state=collapsed]/sidebar:hidden">
            Workspace
          </SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.to}>
                <NavLink item={item} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-1">
          <ThemeToggle />
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={async () => {
              try {
                await signOut(supabase);
                queryClient.clear();
                await navigate({ to: "/sign-in", replace: true });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Sign out failed",
                );
              }
            }}
          >
            <LogOutIcon className="size-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavLink({
  item,
}: {
  item: (typeof navItems)[number];
}) {
  const { setOpenMobile } = useSidebar();
  const Icon = item.icon;

  return (
    <SidebarMenuButton asChild>
      <Link
        to={item.to}
        activeProps={{
          className: "bg-muted font-medium text-foreground",
        }}
        onClick={() => setOpenMobile(false)}
      >
        <Icon className="size-4" />
        <span className="truncate group-data-[state=collapsed]/sidebar:hidden">
          {item.label}
        </span>
      </Link>
    </SidebarMenuButton>
  );
}
