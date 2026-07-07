import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { KatexText } from "@/components/katex-text";
import { PixelAvatar } from "@/components/pixel-avatar";
import { Badge } from "@/components/ui/badge";
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
      <section className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Profile</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {profile.data.display_name}
          </h1>
        </div>

        <ProfileSummaryCard
          profile={profile.data}
          userEmail={undefined}
          activity={activity}
        />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ProfileSidebar profile={profile.data} overview={overview.data} />
          <div className="min-w-0 space-y-6">
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
    <section className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Profile</p>
        <h1 className="mt-2 text-2xl font-semibold">
          {profile.data.display_name}
        </h1>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="grid min-w-0 gap-5 p-4 sm:grid-cols-[104px_minmax(0,1fr)] sm:p-5 lg:grid-cols-[148px_minmax(0,1fr)]">
          <PixelAvatar
            avatarId={profile.data.avatar_id}
            color={profile.data.avatar_color}
            label={profile.data.display_name}
            className="size-24 rounded-xl sm:size-26 lg:size-32"
          />
          <div className="min-w-0 space-y-4">
            <div>
              <h2 className="truncate text-xl font-semibold">
                {profile.data.display_name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Joined {new Date(profile.data.created_at).toLocaleDateString()}
              </p>
            </div>
            {profile.data.bio ? (
              <KatexText
                text={profile.data.bio}
                className="text-sm leading-6 text-muted-foreground"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Shared clubs</h2>
        <div className="mt-3 space-y-2">
          {memberships.data.length > 0 ? (
            memberships.data.map((membership) => (
              <Link
                key={membership.club_id}
                to="/app/clubs/$clubId/schedule"
                params={{ clubId: membership.club_id }}
                className="block rounded-md border p-3 transition-colors hover:bg-muted/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {membership.clubs.name}
                  </span>
                  <Badge variant="secondary">{membership.role}</Badge>
                </div>
                {membership.clubs.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
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
