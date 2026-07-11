import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MembersPage } from "@/features/clubs/MembersPage";

const testState = vi.hoisted(() => ({
  memberName: "member-name-without-break-opportunities-that-must-truncate",
  isManager: false,
  applications: [] as Array<Record<string, unknown>>,
  mutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: testState.mutate }),
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
      : queryKey[0] === "applications"
        ? { data: testState.applications }
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
  joinRequestsQueryOptions: () => ({ queryKey: ["applications"] }),
  membersQueryOptions: () => ({ queryKey: ["members"] }),
}));

vi.mock("@/features/clubs/api", () => ({
  createInviteLink: vi.fn(),
  isClubManagerRole: () => testState.isManager,
  leaveClub: vi.fn(),
  reviewClubJoinRequest: vi.fn(),
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
  beforeEach(() => {
    testState.isManager = false;
    testState.applications = [];
    testState.mutate.mockReset();
  });

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

  it("lets managers review the minimum applicant profile projection", () => {
    testState.isManager = true;
    testState.applications = [
      {
        request_id: "request-1",
        user_id: "applicant-1",
        display_name: "Ada Applicant",
        avatar_id: "robot",
        avatar_color: "#22c55e",
        bio: "Reads causal inference and statistics papers.",
        created_at: "2026-07-11T12:00:00.000Z",
      },
    ];

    render(<MembersPage clubId="club-1" />);

    expect(screen.getByRole("heading", { name: "Applications" })).toBeVisible();
    expect(screen.getByText("Ada Applicant")).toBeVisible();
    expect(
      screen.getByText("Reads causal inference and statistics papers."),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Approve Ada Applicant" }),
    );
    expect(testState.mutate).toHaveBeenCalledWith({
      requestId: "request-1",
      decision: "approved",
    });
  });
});
