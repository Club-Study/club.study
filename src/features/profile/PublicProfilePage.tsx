import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { KatexText } from "@/components/katex-text";
import { PixelAvatar } from "@/components/pixel-avatar";
import { useCurrentUser } from "@/features/auth/queries";
import { ProfileLoading } from "@/features/profile/components/ProfileLoading";
import { ProfileSidebar } from "@/features/profile/components/ProfileSidebar";
import { ProfileSummaryCard } from "@/features/profile/components/ProfileSummaryCard";
import { RecentReadsCard } from "@/features/profile/components/RecentReadsCard";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { buildProfileActivity } from "@/features/profile/profileActivity";
import {
  profileMembershipsQueryOptions,
  profileOverviewQueryOptions,
  profileQueryOptions,
} from "@/features/profile/queries";

export function PublicProfilePage({ userId }: { userId: string }) {
  const currentUser = useCurrentUser();
  const isCurrentUser = currentUser.data?.id === userId;
  const canLoadPublicProfile =
    Boolean(userId) && !currentUser.isPending && !isCurrentUser;
  const profile = useQuery({
    ...profileQueryOptions(userId),
    enabled: canLoadPublicProfile,
  });
  const memberships = useQuery({
    ...profileMembershipsQueryOptions(userId),
    enabled: canLoadPublicProfile && profile.data?.is_public === false,
  });
  const overview = useQuery({
    ...profileOverviewQueryOptions(userId),
    enabled: canLoadPublicProfile && profile.data?.is_public === true,
  });
  const activity = useMemo(() => {
    if (!overview.data) {
      return null;
    }

    return buildProfileActivity(overview.data);
  }, [overview.data]);

  if (currentUser.error) {
    throw currentUser.error;
  }

  if (currentUser.isPending) {
    return <ProfileLoading />;
  }

  if (!currentUser.data) {
    throw new Error("Profile route requires a signed-in user.");
  }

  if (isCurrentUser) {
    return <ProfilePage />;
  }

  if (profile.error) {
    throw profile.error;
  }

  if (profile.data?.is_public === false && memberships.error) {
    throw memberships.error;
  }

  if (overview.error) {
    throw overview.error;
  }

  if (
    profile.isPending ||
    (profile.data?.is_public === false && memberships.isPending)
  ) {
    return <ProfileLoading />;
  }

  if (!profile.data) {
    throw new Error("Profile query completed without profile data.");
  }

  if (profile.data.is_public && (overview.isPending || !activity)) {
    return <ProfileLoading />;
  }

  if (profile.data.is_public && !overview.data) {
    throw new Error("Profile overview query completed without overview data.");
  }

  if (profile.data.is_public && overview.data && activity) {
    return (
      <section className="mx-auto max-w-6xl space-y-14">
        <ProfileSummaryCard
          profile={profile.data}
          activity={activity}
        />

        <div className="grid min-w-0 gap-12 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <ProfileSidebar
            profile={profile.data}
            overview={overview.data}
            activity={activity}
          />
          <div className="min-w-0">
            <RecentReadsCard overview={overview.data} readOnly />
          </div>
        </div>
      </section>
    );
  }

  if (!memberships.data) {
    throw new Error("Profile memberships query completed without membership data.");
  }

  return (
    <section className="mx-auto max-w-5xl space-y-10">
      <section className="grid min-w-0 gap-6 md:grid-cols-[7rem_minmax(0,1fr)]">
        <PixelAvatar
          avatarId={profile.data.avatar_id}
          color={profile.data.avatar_color}
          label={profile.data.display_name}
          className="size-24 rounded-sm md:size-28"
        />
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="truncate text-2xl font-semibold leading-tight">
              {profile.data.display_name}
            </h2>
          </div>
          {profile.data.bio ? (
            <KatexText
              text={profile.data.bio}
              className="text-sm leading-6 text-muted-foreground"
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase text-muted-foreground">
          Shared clubs
        </h2>
        <div className="space-y-1">
          {memberships.data.length > 0 ? (
            memberships.data.map((membership) => (
              <Link
                key={membership.club_id}
                to="/app/clubs/$clubId/schedule"
                params={{ clubId: membership.club_id }}
                className="-mx-2 block rounded-sm px-2 py-3 transition-colors hover:bg-card/70"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {membership.clubs.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {membership.role}
                  </span>
                </div>
                {membership.clubs.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {membership.clubs.description}
                  </p>
                ) : null}
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No shared clubs.</p>
          )}
        </div>
      </section>
    </section>
  );
}
