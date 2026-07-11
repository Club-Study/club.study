import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClubsPage } from "@/features/clubs/ClubsPage";

const testState = vi.hoisted(() => ({
  clubName: "repository-card-name-without-breaks-that-must-truncate-on-mobile",
}));

vi.mock("@/features/auth/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" }, isPending: false }),
}));

vi.mock("@/features/clubs/queries", () => ({
  clubsQueryOptions: () => ({ queryKey: ["clubs"] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "club-1",
        name: testState.clubName,
        description:
          "descriptionwithoutbreakopportunitiesthatmustremaininsidethecard",
        viewerRole: "owner",
        memberCount: 1,
      },
    ],
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="#club" className={className}>
      {children}
    </a>
  ),
}));

describe("ClubsPage", () => {
  it("keeps a long repository name inside its grid card", () => {
    render(<ClubsPage />);

    const heading = screen.getByRole("heading", {
      level: 2,
      name: testState.clubName,
    });
    const card = heading.closest("a");
    const grid = card?.parentElement;

    expect(heading.closest("section")).toHaveClass("min-w-0");
    expect(grid).toHaveClass("min-w-0");
    expect(card).toHaveClass("min-w-0", "overflow-hidden");
    expect(heading).toHaveClass("truncate");
    expect(heading).toHaveAttribute("title", testState.clubName);
    expect(
      screen.getByText(
        "descriptionwithoutbreakopportunitiesthatmustremaininsidethecard",
      ),
    ).toHaveClass("[overflow-wrap:anywhere]");
  });
});
