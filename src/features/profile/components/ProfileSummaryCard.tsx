import type { ReactNode } from "react";

import { PixelAvatar } from "@/components/pixel-avatar";
import type { Profile } from "@/features/profile/api";
import { ContributionGraph } from "@/features/profile/components/ContributionGraph";
import type { ProfileActivity } from "@/features/profile/profileActivity";

export function ProfileSummaryCard({
  profile,
  activity,
  editControl,
}: {
  profile: Profile;
  activity: ProfileActivity;
  editControl?: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-6">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="min-w-0 truncate text-2xl font-semibold leading-tight">
          {profile.display_name}
        </h2>
        {editControl}
      </div>

      <div className="grid min-w-0 gap-10 [--activity-cell:0.9375rem] [--activity-gap:0.25rem] [--activity-height:8.0625rem] lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12 lg:items-start">
        <PixelAvatar
          avatarId={profile.avatar_id}
          color={profile.avatar_color}
          label={profile.display_name}
          className="size-[var(--activity-height)] justify-self-center rounded-none border-0 bg-transparent"
        />

        <ContributionGraph
          cells={activity.contributionCells}
          label="Reading activity over the past 49 weeks"
        />
      </div>
    </section>
  );
}
