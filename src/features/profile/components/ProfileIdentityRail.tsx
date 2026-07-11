import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";

import { KatexText } from "@/components/katex-text";
import { PixelAvatar } from "@/components/pixel-avatar";
import { Separator } from "@/components/ui/separator";
import type {
  Profile,
  ProfileMembership,
  ProfileOverview,
} from "@/features/profile/api";
import { truncateProfileBio } from "@/features/profile/profileBio";
import type { ProfileActivity } from "@/features/profile/profileActivity";

const CLUB_ROW_HEIGHT = 72;
const CLUB_VISIBLE_ROWS = 5;
const CLUB_OVERSCAN = 2;

export function ProfileIdentityRail({
  profile,
  overview,
  activity,
  editControl,
}: {
  profile: Profile;
  overview: ProfileOverview;
  activity: ProfileActivity;
  editControl?: ReactNode;
}) {
  const bio = truncateProfileBio(profile.bio);

  return (
    <aside className="min-w-0 space-y-6">
      <div className="min-w-0 space-y-3">
        <div
          data-slot="profile-identity-header"
          className="inline-flex min-w-0 max-w-full flex-col items-center gap-6 align-top"
        >
          <PixelAvatar
            avatarId={profile.avatar_id}
            color={profile.avatar_color}
            label={profile.display_name}
            className="size-20 rounded-md border-border/70 bg-card xl:size-28"
          />
          <div
            data-slot="profile-name-row"
            className="flex min-w-0 max-w-full items-center gap-2"
          >
            <h1 className="min-w-0 truncate text-left text-2xl font-semibold leading-tight">
              {profile.display_name}
            </h1>
            <div className="flex shrink-0 items-center">{editControl}</div>
          </div>
        </div>
        {bio ? (
          <KatexText
            text={bio}
            className="text-sm leading-6 text-muted-foreground"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No bio yet.</p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3" aria-label="Reading summary">
        <ProfileStat label="Reading" value={activity.readingCount} />
        <ProfileStat label="Planned" value={activity.plannedCount} />
        <ProfileStat label="Read" value={activity.readCount} />
      </dl>

      <Separator className="bg-border/70" />

      <section className="space-y-3" aria-labelledby="profile-clubs-heading">
        <h2 id="profile-clubs-heading" className="text-sm font-semibold">
          Clubs
        </h2>
        <VirtualizedClubList memberships={overview.memberships} />
      </section>
    </aside>
  );
}

function VirtualizedClubList({
  memberships,
}: {
  memberships: ProfileMembership[];
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = memberships.length * CLUB_ROW_HEIGHT;
  const viewportHeight = Math.min(totalHeight, CLUB_ROW_HEIGHT * CLUB_VISIBLE_ROWS);
  const range = useMemo(() => {
    const firstVisible = Math.floor(scrollTop / CLUB_ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / CLUB_ROW_HEIGHT);
    const start = Math.max(0, firstVisible - CLUB_OVERSCAN);
    const end = Math.min(
      memberships.length,
      firstVisible + visibleCount + CLUB_OVERSCAN,
    );

    return { start, end };
  }, [memberships.length, scrollTop, viewportHeight]);

  if (memberships.length === 0) {
    return <p className="text-sm text-muted-foreground">No joined clubs.</p>;
  }

  return (
    <div
      className="-mx-2 overflow-y-auto pr-1"
      style={{ maxHeight: viewportHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div className="relative" style={{ height: totalHeight }}>
        {memberships.slice(range.start, range.end).map((membership, index) => (
          <ClubMembershipLink
            key={membership.club_id}
            membership={membership}
            top={(range.start + index) * CLUB_ROW_HEIGHT}
          />
        ))}
      </div>
    </div>
  );
}

function ClubMembershipLink({
  membership,
  top,
}: {
  membership: ProfileMembership;
  top: number;
}) {
  return (
    <Link
      to="/app/clubs/$clubId/schedule"
      params={{ clubId: membership.club_id }}
      className="absolute left-0 right-0 block h-[72px] rounded-sm px-2 py-2 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{ transform: `translateY(${top}px)` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">
          {membership.clubs.name}
        </span>
        <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
          {membership.role}
        </span>
      </div>
      {membership.clubs.description ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {membership.clubs.description}
        </p>
      ) : null}
    </Link>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="order-2 mt-1 truncate text-[10px] text-muted-foreground">
        {label}
      </dt>
      <dd className="order-1 text-base font-semibold leading-none">{value}</dd>
    </div>
  );
}
