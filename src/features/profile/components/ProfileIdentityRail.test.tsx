import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Profile, ProfileOverview } from "@/features/profile/api";
import { ProfileIdentityRail } from "@/features/profile/components/ProfileIdentityRail";
import type { ProfileActivity } from "@/features/profile/profileActivity";

const profile: Profile = {
  avatar_color: "#ef4444",
  avatar_id: "robot",
  bio: null,
  created_at: "2026-07-10T00:00:00.000Z",
  display_name: "Thomas Hagland",
  id: "user-1",
  is_public: true,
  updated_at: "2026-07-10T00:00:00.000Z",
};

const overview: ProfileOverview = {
  memberships: [],
  personalPapers: [],
  readingLogs: [],
  readingSessions: [],
  scheduledPapers: [],
};

const activity: ProfileActivity = {
  contributionCells: [],
  plannedCount: 0,
  readCount: 0,
  readingCount: 0,
};

describe("ProfileIdentityRail", () => {
  it("aligns the display name with the bio and centers the avatar over the name row", () => {
    render(
      <ProfileIdentityRail
        profile={profile}
        overview={overview}
        activity={activity}
        editControl={<button type="button">Edit profile</button>}
      />,
    );

    const avatar = screen.getByRole("img", { name: "Thomas Hagland" });
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Thomas Hagland",
    });
    const identityHeader = avatar.closest(
      '[data-slot="profile-identity-header"]',
    );
    const nameRow = heading.closest('[data-slot="profile-name-row"]');
    const bio = screen.getByText("No bio yet.");

    expect(identityHeader).not.toBeNull();
    expect(identityHeader).toHaveClass(
      "inline-flex",
      "max-w-full",
      "items-center",
    );
    expect(identityHeader).toContainElement(heading);
    expect(nameRow).toHaveClass("flex", "max-w-full", "items-center", "gap-2");
    expect(nameRow).not.toHaveClass("w-full");
    expect(heading).toHaveClass("text-left");
    expect(identityHeader).not.toContainElement(bio);
    expect(identityHeader?.parentElement).toBe(bio.parentElement);
  });
});
