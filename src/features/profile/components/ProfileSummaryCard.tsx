import { PixelAvatar } from "@/components/pixel-avatar";
import type { Profile } from "@/features/profile/api";
import { ContributionGraph } from "@/features/profile/components/ContributionGraph";
import type { ProfileActivity } from "@/features/profile/profileActivity";

export function ProfileSummaryCard({
  profile,
  userEmail,
  activity,
}: {
  profile: Profile;
  userEmail: string | undefined;
  activity: ProfileActivity;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="grid min-w-0 gap-5 p-4 sm:grid-cols-[104px_minmax(0,1fr)] sm:p-5 lg:grid-cols-[148px_minmax(0,1fr)]">
        <PixelAvatar
          avatarId={profile.avatar_id}
          color={profile.avatar_color}
          label={profile.display_name}
          className="size-24 rounded-xl sm:size-26 lg:size-32"
        />
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="truncate text-xl font-semibold">
                  {profile.display_name}
                </h2>
                {userEmail ? (
                  <p className="text-sm text-muted-foreground">{userEmail}</p>
                ) : null}
              </div>
              {profile.bio ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {profile.bio}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <ProfileStat label="Reading" value={activity.readingCount} />
              <ProfileStat label="Planned" value={activity.plannedCount} />
              <ProfileStat label="Read" value={activity.readCount} />
            </div>
          </div>
          <ContributionGraph
            cells={activity.contributionCells}
            label="Reading activity over the past 49 weeks"
          />
        </div>
      </div>
    </section>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-16 rounded-md bg-muted/45 px-3 py-2 text-center">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
