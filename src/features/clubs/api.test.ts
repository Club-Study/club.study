import { describe, expect, it } from "vitest";

import { normalizeClubListRow, type Club } from "@/features/clubs/api";

const club: Club = {
  id: "club-id",
  name: "Interpretability Reading Group",
  slug: "interpretability-reading-group",
  description: "Papers about understanding neural networks.",
  created_by: "owner-id",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-10T00:00:00.000Z",
};

describe("normalizeClubListRow", () => {
  it("normalizes one viewer membership and one member-count aggregate", () => {
    expect(
      normalizeClubListRow({
        ...club,
        viewer_membership: [{ role: "owner" }],
        member_count: [{ count: 4 }],
      }),
    ).toEqual({
      ...club,
      viewerRole: "owner",
      memberCount: 4,
    });
  });

  it.each([
    { viewerMembership: [] },
    { viewerMembership: [{ role: "member" }, { role: "admin" }] },
    { viewerMembership: [{ role: "guest" }] },
  ])(
    "rejects malformed viewer membership projection %#",
    ({ viewerMembership }) => {
      expect(() =>
        normalizeClubListRow({
          ...club,
          viewer_membership: viewerMembership,
          member_count: [{ count: 1 }],
        }),
      ).toThrow();
    },
  );

  it.each([
    { memberCount: [] },
    { memberCount: [{ count: 1 }, { count: 2 }] },
    { memberCount: [{ count: -1 }] },
    { memberCount: [{ count: Number.NaN }] },
    { memberCount: [{ count: Number.POSITIVE_INFINITY }] },
    { memberCount: [{ count: 1.5 }] },
    { memberCount: [{ count: "2" }] },
  ])("rejects malformed member-count projection %#", ({ memberCount }) => {
    expect(() =>
      normalizeClubListRow({
        ...club,
        viewer_membership: [{ role: "member" }],
        member_count: memberCount,
      }),
    ).toThrow();
  });
});
