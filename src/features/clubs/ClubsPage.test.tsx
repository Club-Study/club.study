import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClubsPage } from "@/features/clubs/ClubsPage";

const testState = vi.hoisted(() => ({
  clubName: "repository-card-name-without-breaks-that-must-truncate-on-mobile",
  apply: vi.fn(),
  clubs: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/features/auth/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" }, isPending: false }),
}));

vi.mock("@/features/clubs/queries", () => ({
  clubDirectoryQueryOptions: () => ({ queryKey: ["club-directory"] }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: testState.apply }),
  useQuery: () => ({
    data: testState.clubs,
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="#club" className={className}>
      {children}
    </a>
  ),
}));

describe("ClubsPage", () => {
  beforeEach(() => {
    testState.apply.mockReset();
    testState.clubs = [
      {
        id: "club-1",
        name: testState.clubName,
        description:
          "descriptionwithoutbreakopportunitiesthatmustremaininsidethecard",
        viewerRole: "owner",
        memberCount: 1,
        applicationStatus: null,
        applicationCreatedAt: null,
      },
      {
        id: "club-2",
        name: "Causal Inference Club",
        description: "Weekly causal inference papers.",
        viewerRole: null,
        memberCount: 4,
        applicationStatus: null,
        applicationCreatedAt: null,
      },
      {
        id: "club-3",
        name: "Interpretability Club",
        description: "Mechanistic interpretability papers.",
        viewerRole: null,
        memberCount: 2,
        applicationStatus: "pending",
        applicationCreatedAt: "2026-07-11T12:00:00.000Z",
      },
    ];
  });

  it("keeps a long repository name inside its grid card", () => {
    render(<ClubsPage />);

    const heading = screen.getByRole("heading", {
      level: 3,
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

  it("separates memberships from discoverable clubs and applies from a card", () => {
    render(<ClubsPage />);

    expect(screen.getByRole("heading", { name: "Your clubs" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Discover clubs" })).toBeVisible();
    expect(screen.getByText("4 members")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Apply to Causal Inference Club" }),
    );
    expect(testState.apply).toHaveBeenCalledWith("club-2");
  });

  it("shows a disabled pending state instead of allowing duplicate applications", () => {
    render(<ClubsPage />);

    expect(
      screen.getByRole("button", {
        name: "Application pending for Interpretability Club",
      }),
    ).toBeDisabled();
  });
});
