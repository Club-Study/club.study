import { describe, expect, it } from "vitest";

import {
  normalizeClubEmailSubscription,
  normalizeClubListRow,
  normalizeDiscoverableClubRow,
  type Club,
} from "@/features/clubs/api";

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

describe("normalizeDiscoverableClubRow", () => {
  it("normalizes nullable viewer and application state", () => {
    expect(
      normalizeDiscoverableClubRow({
        id: "club-id",
        name: "Interpretability Reading Group",
        description: null,
        member_count: 3,
        viewer_role: null,
        application_status: "pending",
        application_created_at: "2026-07-11T12:00:00.000Z",
      }),
    ).toEqual({
      id: "club-id",
      name: "Interpretability Reading Group",
      description: null,
      memberCount: 3,
      viewerRole: null,
      applicationStatus: "pending",
      applicationCreatedAt: "2026-07-11T12:00:00.000Z",
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid member count %s",
    (memberCount) => {
      expect(() =>
        normalizeDiscoverableClubRow({
          id: "club-id",
          name: "Club",
          description: null,
          member_count: memberCount,
          viewer_role: null,
          application_status: null,
          application_created_at: null,
        }),
      ).toThrow("invalid member count");
    },
  );
});

describe("normalizeClubEmailSubscription", () => {
  const expected = { clubId: "club-id", userId: "user-id" };

  it("returns false when no subscription exists", () => {
    expect(normalizeClubEmailSubscription(null, expected)).toBe(false);
  });

  it("returns true only for the expected member subscription", () => {
    expect(
      normalizeClubEmailSubscription(
        { club_id: "club-id", user_id: "user-id" },
        expected,
      ),
    ).toBe(true);
  });

  it.each([
    { club_id: "another-club", user_id: "user-id" },
    { club_id: "club-id", user_id: "another-user" },
  ])("rejects an unexpected subscription row %#", (row) => {
    expect(() => normalizeClubEmailSubscription(row, expected)).toThrow(
      "unexpected row",
    );
  });
});
