import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Club</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {club.data?.name ?? "Club"}
          </h1>
          {club.data?.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {club.data.description}
            </p>
          ) : null}
        </div>
        {club.data && isManager ? <EditClubDialog club={club.data} /> : null}
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
      <div className="mt-6">
        <Outlet />
      </div>
    </section>
  );
}
