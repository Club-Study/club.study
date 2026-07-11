import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sidebar, SidebarContent, SidebarProvider } from "@/components/ui/sidebar";

describe("Sidebar", () => {
  it("stays viewport-height while the document content scrolls", () => {
    render(
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>Navigation</SidebarContent>
        </Sidebar>
      </SidebarProvider>,
    );

    const sidebar = screen.getByRole("complementary");

    expect(sidebar).toHaveClass("sticky", "top-0", "h-dvh", "self-start");
    expect(sidebar).not.toHaveClass("min-h-dvh");
  });
});
