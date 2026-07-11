import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { QueryErrorNotice } from "@/components/query-error-notice";
import { useCurrentUser } from "@/features/auth/queries";
import { isClubManagerRole } from "@/features/clubs/api";
import { EditClubDialog } from "@/features/clubs/EditClubDialog";
import {
  clubQueryOptions,
  membersQueryOptions,
} from "@/features/clubs/queries";

export function ClubShell({ clubId }: { clubId: string }) {
  const club = useQuery(clubQueryOptions(clubId));
  const currentUser = useCurrentUser();
  const members = useQuery(membersQueryOptions(clubId));
  const currentMembership = members.data?.find(
    (member) => member.user_id === currentUser.data?.id,
  );
  const isManager = isClubManagerRole(currentMembership?.role);
  const clubName = club.data?.name ?? "Club";

  if (club.error) {
    return (
      <QueryErrorNotice
        error={club.error}
        fallbackMessage="Could not load this club. Please try again."
      />
    );
  }

  if (members.error || currentUser.error) {
    return (
      <QueryErrorNotice
        error={members.error ?? currentUser.error}
        fallbackMessage="Could not verify your club access. Please try again."
      />
    );
  }

  return (
    <section className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">Club</p>
          <h1
            className="mt-2 truncate text-2xl font-semibold"
            title={clubName}
          >
            {clubName}
          </h1>
          {club.data?.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {club.data.description}
            </p>
          ) : null}
        </div>
        {club.data && isManager ? (
          <div className="shrink-0">
            <EditClubDialog club={club.data} />
          </div>
        ) : null}
      </div>
      <nav className="mt-6 flex gap-4 border-b text-sm text-muted-foreground">
        <Link
          to="/app/clubs/$clubId/schedule"
          params={{ clubId }}
          activeProps={{ className: "text-foreground border-b border-foreground" }}
          className="pb-2"
        >
          Schedule
        </Link>
        <Link
          to="/app/clubs/$clubId/members"
          params={{ clubId }}
          activeProps={{ className: "text-foreground border-b border-foreground" }}
          className="pb-2"
        >
          Members
        </Link>
      </nav>
      <div className="mt-6 min-w-0">
        <Outlet />
      </div>
    </section>
  );
}
