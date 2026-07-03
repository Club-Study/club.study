import type { Json } from "@/lib/supabase/database.types";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import type { ProfileReadingLog } from "@/features/profile/api";
import { formatWeekLabel } from "@/lib/dates/week";

export function RecentReadsCard({
  logs,
  readCount,
}: {
  logs: ProfileReadingLog[];
  readCount: number;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Recent Reads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Papers marked read across your clubs.
          </p>
        </div>
        <Badge variant="outline">{readCount} total</Badge>
      </div>
      <div className="mt-3 divide-y">
        {logs.length > 0 ? (
          logs.slice(0, 8).map((log) => <ReadingLogRow key={log.id} log={log} />)
        ) : (
          <p className="py-3 text-sm text-muted-foreground">No papers read yet.</p>
        )}
      </div>
    </section>
  );
}

function ReadingLogRow({ log }: { log: ProfileReadingLog }) {
  const schedule = log.club_paper_schedule;

  return (
    <Link
      to="/app/papers/$scheduleId"
      params={{ scheduleId: schedule.id }}
      className="block py-3 transition-colors hover:bg-muted/25"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{schedule.papers.title}</p>
        <span className="text-xs text-muted-foreground">
          {new Date(log.read_at).toLocaleDateString()}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{schedule.clubs.name}</span>
        <span>{formatWeekLabel(schedule.week_start)}</span>
        <PaperAuthors authors={schedule.papers.authors} />
      </div>
    </Link>
  );
}

function PaperAuthors({ authors }: { authors: Json | null }) {
  const label = formatAuthors(authors);

  if (!label) {
    return null;
  }

  return <span>{label}</span>;
}

function formatAuthors(authors: Json | null) {
  if (!authors) {
    return null;
  }

  if (!Array.isArray(authors)) {
    throw new Error("Paper authors must be an array.");
  }

  const names = authors.map((author) => {
    if (typeof author !== "string") {
      throw new Error("Paper authors must be strings.");
    }

    return author;
  });

  return names.slice(0, 3).join(", ");
}
