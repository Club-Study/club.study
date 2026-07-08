import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { KatexText } from "@/components/katex-text";
import type {
  Profile,
  ProfileMembership,
  ProfileOverview,
} from "@/features/profile/api";
import { truncateProfileBio } from "@/features/profile/profileBio";
import type { ProfileActivity } from "@/features/profile/profileActivity";

const CLUB_ROW_HEIGHT = 76;
const CLUB_VISIBLE_ROWS = 5;
const CLUB_OVERSCAN = 2;

export function ProfileSidebar({
  profile,
  overview,
  activity,
}: {
  profile: Profile;
  overview: ProfileOverview;
  activity?: ProfileActivity;
}) {
  const bio = truncateProfileBio(profile.bio);

  return (
    <aside className="space-y-10">
      {activity ? (
        <section className="grid grid-cols-3">
          <ProfileStat label="Reading" value={activity.readingCount} align="start" />
          <ProfileStat label="Planned" value={activity.plannedCount} align="center" />
          <ProfileStat label="Read" value={activity.readCount} align="end" />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase text-muted-foreground">
          Bio
        </h2>
        {bio ? (
          <KatexText
            text={bio}
            className="text-sm leading-6 text-muted-foreground"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No bio yet.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase text-muted-foreground">
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
      className="absolute left-0 right-0 block h-[76px] rounded-sm px-2 py-2 transition-colors hover:bg-card/70"
      style={{ transform: `translateY(${top}px)` }}
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
  );
}

function ProfileStat({
  label,
  value,
  align,
}: {
  label: string;
  value: number;
  align: "start" | "center" | "end";
}) {
  return (
    <div
      className={`flex min-w-0 ${
        align === "center"
          ? "justify-center"
          : align === "end"
            ? "justify-end"
            : "justify-start"
      }`}
    >
      <div className="min-w-0 text-left">
        <div className="text-base font-semibold leading-none">{value}</div>
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
