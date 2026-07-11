import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SchedulePage } from "@/features/schedule/SchedulePage";

const testState = vi.hoisted(() => ({
  title: "scheduled-paper-title-without-break-opportunities-that-must-truncate",
  scheduleError: null as Error | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "schedule") {
      return {
        error: testState.scheduleError,
        data: [
          {
            id: "schedule-1",
            week_start: "2026-07-13",
            papers: { title: testState.title, source_type: "manual" },
            suggested_by: { id: "user-2", display_name: "Reader" },
          },
        ],
      };
    }

    return { data: [] };
  },
}));

vi.mock("@/features/clubs/queries", () => ({
  membersQueryOptions: () => ({ queryKey: ["members"] }),
}));

vi.mock("@/features/schedule/queries", () => ({
  scheduleListQueryOptions: () => ({ queryKey: ["schedule"] }),
  scheduleProgressQueryOptions: () => ({ queryKey: ["progress"] }),
}));

vi.mock("@/features/auth/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" } }),
}));

vi.mock("@/features/clubs/api", () => ({
  isClubManagerRole: () => false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className, title }: {
    children: React.ReactNode;
    className?: string;
    title?: string;
  }) => (
    <a href="#paper" className={className} title={title}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/profile/components/ProfileLink", () => ({
  ProfileLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/features/schedule/components/AddPaperDialog", () => ({
  AddPaperDialog: () => <button type="button">Add paper</button>,
}));

vi.mock("@/features/schedule/components/SchedulePaperActions", () => ({
  SchedulePaperActions: () => null,
}));

describe("SchedulePage", () => {
  afterEach(() => {
    testState.scheduleError = null;
  });

  it("uses a fixed table and truncates a long paper title", () => {
    render(<SchedulePage clubId="club-1" />);

    const table = screen.getByRole("table");
    const title = screen.getByRole("link", { name: testState.title });
    const paperCell = title.closest("td");

    expect(table).toHaveClass("table-fixed");
    expect(paperCell).toHaveClass("min-w-0", "overflow-hidden");
    expect(title).toHaveClass("block", "truncate");
    expect(title).toHaveAttribute("title", testState.title);
  });

  it("surfaces a safe schedule query error instead of an empty schedule", () => {
    testState.scheduleError = new Error("sensitive database details");

    render(<SchedulePage clubId="club-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load the club schedule. Please try again.",
    );
    expect(screen.queryByRole("table")).toBeNull();
  });
});
