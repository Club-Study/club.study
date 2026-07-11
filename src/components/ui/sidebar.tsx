import { PanelLeftIcon } from "lucide-react";
import * as React from "react";
import { Slot } from "radix-ui";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) {
        setUncontrolledOpen(nextOpen);
      }
    },
    [controlledOpen, onOpenChange],
  );
  const toggleSidebar = React.useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <SidebarContext.Provider
      value={{
        open,
        setOpen,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }}
    >
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "17rem",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "flex min-h-dvh w-full bg-background text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  className,
  children,
  collapsible = "icon",
  ...props
}: React.ComponentProps<"aside"> & {
  collapsible?: "icon" | "none";
}) {
  const { open, openMobile, setOpenMobile } = useSidebar();

  return (
    <>
      <aside
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        className={cn(
          "group/sidebar sticky top-0 hidden h-dvh shrink-0 self-start overflow-hidden border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col",
          collapsible === "icon"
            ? open
              ? "w-(--sidebar-width)"
              : "w-14"
            : "w-(--sidebar-width)",
          "transition-[width] duration-200 ease-linear",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[min(20rem,calc(100vw-2rem))] gap-0 bg-sidebar p-0 text-sidebar-foreground"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main COsearch navigation
          </SheetDescription>
          <div className="flex min-h-dvh flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("min-w-0 flex-1 bg-background", className)}
      {...props}
    />
  );
}

function SidebarTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpenMobile, toggleSidebar } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={() => {
        if (window.matchMedia("(min-width: 768px)").matches) {
          toggleSidebar();
        } else {
          setOpenMobile(true);
        }
      }}
      {...props}
    >
      <PanelLeftIcon className="size-4" />
      <span className="sr-only">Toggle navigation</span>
    </Button>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex h-16 items-center border-b px-4", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("min-h-0 flex-1 overflow-auto px-3 py-5", className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("mt-auto border-t p-3", className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-3 py-1 text-[11px] font-medium uppercase text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("grid gap-1.5", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("min-w-0", className)}
      {...props}
    />
  );
}

function SidebarMenuButton({
  className,
  isActive,
  asChild = false,
  ...props
}: React.ComponentProps<"a"> & {
  isActive?: boolean;
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive ? "true" : "false"}
      className={cn(
        "relative flex h-10 min-w-0 items-center rounded-sm px-3 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring",
        "data-[active=true]:bg-muted/70 data-[active=true]:font-medium data-[active=true]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
};
