import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, type ActiveOptions } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { BrandWordmark } from "@/components/brand-wordmark";
import { signOut } from "@/features/auth/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { toUserMessage } from "@/lib/user-facing-error";

type NavItem = {
  label: string;
  to: "/app" | "/app/clubs" | "/app/profile";
  activeOptions?: ActiveOptions;
};

const navItems: readonly NavItem[] = [
  {
    label: "Feed",
    to: "/app",
    activeOptions: { exact: true },
  },
  {
    label: "Clubs",
    to: "/app/clubs",
  },
  {
    label: "Profile",
    to: "/app/profile",
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/app" className="flex min-w-0 items-center px-1">
          <BrandWordmark className="truncate text-[18px] group-data-[state=collapsed]/sidebar:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
                await signOut();
                queryClient.clear();
                await navigate({ to: "/sign-in", replace: true });
              } catch (error) {
                toast.error(
                  toUserMessage(
                    error,
                    "auth",
                    "Sign out failed. Please try again.",
                  ),
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

  return (
    <SidebarMenuButton asChild>
      <Link
        to={item.to}
        activeProps={{
          className: "bg-muted/70 font-medium text-foreground",
        }}
        activeOptions={item.activeOptions}
        onClick={() => setOpenMobile(false)}
      >
        <span className="truncate group-data-[state=collapsed]/sidebar:hidden">
          {item.label}
        </span>
      </Link>
    </SidebarMenuButton>
  );
}
