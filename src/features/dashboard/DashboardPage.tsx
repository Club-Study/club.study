import { Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";

import { clubsQueryOptions } from "@/features/clubs/queries";
import {
  dashboardScheduleQueryOptions,
  scheduleProgressQueryOptions,
} from "@/features/schedule/queries";
import { formatWeekLabel, getCurrentWeekStart } from "@/lib/dates/week";

export function DashboardPage() {
  const clubs = useQuery(clubsQueryOptions);
  const currentWeek = getCurrentWeekStart();
  const schedule = useQuery(dashboardScheduleQueryOptions(currentWeek));
  const upcoming = schedule.data ?? [];
  const visibleClubIds = [
    ...new Set(upcoming.map((row) => row.club_id)),
  ];
  const progressQueries = useQueries({
    queries: visibleClubIds.map((clubId) => scheduleProgressQueryOptions(clubId)),
  });
  const progressBySchedule = new Map(
    progressQueries.flatMap((query) => query.data ?? []).map((row) => [
      row.schedule_id,
      row,
    ]),
  );

  return (
    <section className="space-y-7">
      {clubs.data?.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-4">
          <h2 className="text-sm font-medium">No clubs yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a private club to schedule the first paper.
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-3">
          <h2 className="text-sm font-medium">Upcoming papers</h2>
        </div>
        <div className="space-y-1">
          {upcoming.length > 0 ? (
            upcoming.map((row) => (
              <Link
                key={row.id}
                to="/app/papers/$scheduleId"
                params={{ scheduleId: row.id }}
                className="-mx-2 block rounded-md px-2 py-3 transition-colors hover:bg-muted/35"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">
                    {row.papers?.title ?? "Untitled paper"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatWeekLabel(row.week_start)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{row.clubs?.name ?? "Club"}</span>
                  <span>Suggested by {row.suggested_by?.display_name ?? "Unknown"}</span>
                  <span>
                    {progressBySchedule.get(row.id)?.current_user_read
                      ? "Read"
                      : "Unread"}
                  </span>
                  <span>{formatProgress(progressBySchedule.get(row.id))}</span>
                </div>
              </Link>
            ))
          ) : (
            <p className="p-3 text-sm text-muted-foreground">
              No upcoming papers scheduled.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function formatProgress(
  progress:
    | {
        read_count: number;
        total_members: number;
      }
    | undefined,
) {
  if (!progress) {
    return "0/0 read";
  }

  return `${progress.read_count}/${progress.total_members} read`;
}
