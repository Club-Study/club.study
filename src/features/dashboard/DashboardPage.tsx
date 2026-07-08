import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";

import { clubsQueryOptions } from "@/features/clubs/queries";
import { dashboardScheduleQueryOptions } from "@/features/schedule/queries";
import { formatOptionalDateLabel, getCurrentWeekStart } from "@/lib/dates/week";

export function DashboardPage() {
  const clubs = useQuery(clubsQueryOptions);
  const currentWeek = getCurrentWeekStart();
  const schedule = useQuery(dashboardScheduleQueryOptions(currentWeek));
  const feedItems = schedule.data ?? [];

  return (
    <section className="mx-auto w-full max-w-5xl">
      {clubs.data?.length === 0 ? (
        <div className="mb-8 border-l border-l-[var(--ring)] bg-card/40 px-4 py-3">
          <h2 className="text-sm font-medium text-foreground">No clubs yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a private club to schedule the first paper.
          </p>
        </div>
      ) : null}

      <div className="border-y">
        {feedItems.length > 0 ? (
          feedItems.map((row, index) => (
            <Link
              key={row.id}
              to="/app/papers/$scheduleId"
              params={{ scheduleId: row.id }}
              className="group relative grid gap-4 border-b px-1 py-6 pr-10 transition-colors last:border-b-0 hover:bg-card/70 focus-visible:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:grid-cols-[11rem_minmax(0,1fr)] md:px-4 md:pr-12"
            >
              <div className="space-y-2 text-[11px] leading-5 text-muted-foreground">
                <p className="font-medium text-foreground/80">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p>{row.clubs?.name ?? "Club"}</p>
                <p>{formatScheduledDate(row.week_start)}</p>
                <span className="block h-px w-7 bg-border transition-colors group-hover:bg-[var(--ring)]" />
              </div>

              <div className="min-w-0 space-y-2">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold leading-7 text-foreground md:text-xl">
                    {row.papers?.title ?? "Untitled paper"}
                  </h2>
                  {row.papers?.authors.length ? (
                    <p className="text-sm text-muted-foreground">
                      {formatAuthors(row.papers.authors)}
                    </p>
                  ) : null}
                </div>
                <p className="text-base leading-7 text-muted-foreground">
                  {truncateText(row.papers?.abstract)}
                </p>
              </div>
              <ChevronRightIcon className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:right-4" />
            </Link>
          ))
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No papers have been scheduled yet.
          </p>
        )}
      </div>
    </section>
  );
}

function formatScheduledDate(value: string | null) {
  return `scheduled for ${formatOptionalDateLabel(value, "no date")}`;
}

function formatAuthors(authors: string[]) {
  const visibleAuthors = authors.slice(0, 4).join(", ");

  if (authors.length <= 4) {
    return visibleAuthors;
  }

  return `${visibleAuthors}, et al.`;
}

function truncateText(value: string | null | undefined) {
  if (!value?.trim()) {
    return "No abstract available.";
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  const maxLength = 220;

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}
