import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useCurrentUser } from "@/features/auth/queries";
import { ProfileEditDialog } from "@/features/profile/components/ProfileEditDialog";
import { ProfileLoading } from "@/features/profile/components/ProfileLoading";
import { ProfileSidebar } from "@/features/profile/components/ProfileSidebar";
import { ProfileSummaryCard } from "@/features/profile/components/ProfileSummaryCard";
import { RecentReadsCard } from "@/features/profile/components/RecentReadsCard";
import { buildProfileActivity } from "@/features/profile/profileActivity";
import {
  profileOverviewQueryOptions,
  profileQueryOptions,
} from "@/features/profile/queries";

export function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const user = useCurrentUser();
  const userId = user.data?.id;
  const profile = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: Boolean(userId),
  });
  const overview = useQuery({
    ...profileOverviewQueryOptions(userId ?? ""),
    enabled: Boolean(userId),
  });
  const activity = useMemo(() => {
    if (!overview.data) {
      return null;
    }

    return buildProfileActivity(overview.data);
  }, [overview.data]);

  if (user.error) {
    throw user.error;
  }

  if (profile.error) {
    throw profile.error;
  }

  if (overview.error) {
    throw overview.error;
  }

  if (user.isPending || profile.isPending || overview.isPending) {
    return <ProfileLoading />;
  }

  if (!user.data) {
    throw new Error("Profile route requires a signed-in user.");
  }

  if (!profile.data) {
    throw new Error("Profile query completed without profile data.");
  }

  if (!overview.data || !activity) {
    throw new Error("Profile overview query completed without overview data.");
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Profile</p>
          <h1 className="mt-2 text-2xl font-semibold">{profile.data.display_name}</h1>
        </div>
        <ProfileEditDialog
          open={isEditing}
          onOpenChange={setIsEditing}
          profile={profile.data}
          userEmail={user.data.email}
        />
      </div>

      <ProfileSummaryCard
        profile={profile.data}
        userEmail={user.data.email}
        activity={activity}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ProfileSidebar profile={profile.data} overview={overview.data} />
        <div className="min-w-0 space-y-6">
          <RecentReadsCard
            logs={overview.data.readingLogs}
            readCount={activity.readCount}
          />
        </div>
      </div>
    </section>
  );
}
