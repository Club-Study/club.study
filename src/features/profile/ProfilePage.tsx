import { useQuery } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
    <section className="mx-auto max-w-6xl space-y-14">
      <ProfileSummaryCard
        profile={profile.data}
        activity={activity}
        editControl={
          <ProfileEditDialog
            open={isEditing}
            onOpenChange={setIsEditing}
            profile={profile.data}
            userEmail={user.data.email}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 rounded-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
              >
                <PencilIcon className="size-3.5" />
                <span className="sr-only">Edit profile</span>
              </Button>
            }
          />
        }
      />

      <div className="grid min-w-0 gap-12 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <ProfileSidebar
          profile={profile.data}
          overview={overview.data}
          activity={activity}
        />
        <div className="min-w-0">
          <RecentReadsCard overview={overview.data} />
        </div>
      </div>
    </section>
  );
}
