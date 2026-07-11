import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MembersPage } from "@/features/clubs/MembersPage";

const testState = vi.hoisted(() => ({
  memberName: "member-name-without-break-opportunities-that-must-truncate",
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "members"
      ? {
          data: [
            {
              club_id: "club-1",
              user_id: "user-2",
              role: "member",
              created_at: "2026-07-10T00:00:00.000Z",
              profiles: {
                avatar_id: "robot",
                avatar_color: "#ef4444",
                display_name: testState.memberName,
              },
            },
          ],
        }
      : { data: [] },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user-1" } }),
}));

vi.mock("@/features/clubs/queries", () => ({
  invitesQueryOptions: () => ({ queryKey: ["invites"] }),
  membersQueryOptions: () => ({ queryKey: ["members"] }),
}));

vi.mock("@/features/clubs/api", () => ({
  createInviteLink: vi.fn(),
  isClubManagerRole: () => false,
  leaveClub: vi.fn(),
  revokeInviteLink: vi.fn(),
  setClubMemberRole: vi.fn(),
  transferClubOwnership: vi.fn(),
}));

vi.mock("@/features/profile/components/ProfileLink", () => ({
  ProfileLink: ({ children, className }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href="#member" className={className}>
      {children}
    </a>
  ),
}));

describe("MembersPage", () => {
  it("uses a fixed table and truncates a long member name", () => {
    render(<MembersPage clubId="club-1" />);

    const table = screen.getByRole("table");
    const name = screen.getByText(testState.memberName);
    const memberLink = name.closest("a");
    const memberCell = name.closest("td");

    expect(table).toHaveClass("table-fixed");
    expect(memberCell).toHaveClass("min-w-0", "overflow-hidden");
    expect(memberLink).toHaveClass("min-w-0", "max-w-full");
    expect(name).toHaveClass("min-w-0", "truncate");
    expect(name).toHaveAttribute("title", testState.memberName);
  });
});
