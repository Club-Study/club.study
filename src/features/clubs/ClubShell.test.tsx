import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClubShell } from "@/features/clubs/ClubShell";

const testState = vi.hoisted(() => ({
  clubName: "club-name-without-any-break-opportunities-that-must-not-widen-mobile",
  clubError: null as Error | null,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "club"
      ? {
          error: testState.clubError,
          data: {
            id: "club-1",
            name: testState.clubName,
            description:
              "descriptionwithoutbreakopportunitiesthatmustremaininsidetheheader",
          },
        }
      : { data: [{ user_id: "user-1", role: "owner" }] },
}));

vi.mock("@/features/clubs/queries", () => ({
  clubQueryOptions: () => ({ queryKey: ["club"] }),
  membersQueryOptions: () => ({ queryKey: ["members"] }),
}));

vi.mock("@/features/auth/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" } }),
}));

vi.mock("@/features/clubs/api", () => ({
  isClubManagerRole: () => true,
}));

vi.mock("@/features/clubs/EditClubDialog", () => ({
  EditClubDialog: () => <button type="button">Edit</button>,
}));

vi.mock("@/features/clubs/ClubEmailSubscriptionControl", () => ({
  ClubEmailSubscriptionControl: ({
    clubId,
    userId,
  }: {
    clubId: string;
    userId: string;
  }) => (
    <button type="button" aria-label={`Email updates ${clubId} ${userId}`}>
      Email updates
    </button>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="#club" className={className}>
      {children}
    </a>
  ),
  Outlet: () => null,
}));

describe("ClubShell", () => {
  afterEach(() => {
    testState.clubError = null;
  });

  it("truncates an unbroken club name without widening the page", () => {
    render(<ClubShell clubId="club-1" />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: testState.clubName,
    });
    const description = screen.getByText(
      "descriptionwithoutbreakopportunitiesthatmustremaininsidetheheader",
    );

    expect(heading.closest("section")).toHaveClass("min-w-0");
    expect(heading.parentElement).toHaveClass("min-w-0", "flex-1");
    expect(heading).toHaveClass("truncate");
    expect(heading).toHaveAttribute("title", testState.clubName);
    expect(description).toHaveClass("line-clamp-2", "[overflow-wrap:anywhere]");
    expect(
      screen.getByRole("button", {
        name: "Email updates club-1 user-1",
      }),
    ).toBeVisible();
  });

  it("surfaces a safe club query error instead of a fallback club label", () => {
    testState.clubError = new Error("sensitive database details");

    render(<ClubShell clubId="club-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load this club. Please try again.",
    );
    expect(screen.queryByRole("heading", { name: testState.clubName })).toBeNull();
  });
});
