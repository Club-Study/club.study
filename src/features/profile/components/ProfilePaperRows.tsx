import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import type {
  ProfilePersonalPaper,
  ProfileReadingLog,
  ProfileScheduledPaper,
} from "@/features/profile/api";
import {
  PaperLogControl,
  PaperProgress,
} from "@/features/profile/components/PaperLogControl";
import {
  formatReadDate,
  formatStatusLabel,
  getPaperRows,
  type PaperListView,
} from "@/features/profile/components/profilePaperList";
import type { ProfilePaperBuckets } from "@/features/profile/profileActivity";
import { formatOptionalDateLabel } from "@/lib/dates/week";

export function ProfilePaperRows({
  view,
  buckets,
  empty,
}: {
  view: PaperListView;
  buckets: ProfilePaperBuckets;
  empty: string;
}) {
  const rows = getPaperRows(view, buckets).slice(0, 8);

  if (rows.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }

  return rows.map((row) => {
    if (row.kind === "readLog") {
      return <ReadingLogRow key={row.key} log={row.log} pagesRead={row.pagesRead} />;
    }

    if (row.kind === "personal") {
      return (
        <PersonalPaperRow
          key={row.key}
          personalPaper={row.personalPaper}
          pagesRead={row.pagesRead}
        />
      );
    }

    return (
      <ScheduledPaperRow
        key={row.key}
        schedule={row.schedule}
        pagesRead={row.pagesRead}
      />
    );
  });
}

function ReadingLogRow({
  log,
  pagesRead,
}: {
  log: ProfileReadingLog;
  pagesRead: number;
}) {
  return (
    <ScheduledPaperRow
      schedule={log.club_paper_schedule}
      pagesRead={pagesRead}
      readAt={log.read_at}
    />
  );
}

function ScheduledPaperRow({
  schedule,
  pagesRead,
  readAt,
}: {
  schedule: ProfileScheduledPaper;
  pagesRead: number;
  readAt?: string;
}) {
  const paper = schedule.papers;

  return (
    <article className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/app/papers/$scheduleId"
            params={{ scheduleId: schedule.id }}
            className="truncate text-sm font-medium hover:underline"
          >
            {paper.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{paper.source_type}</Badge>
            <span>{schedule.clubs.name}</span>
            <span>{formatStatusLabel(schedule.status)}</span>
            <span>{formatOptionalDateLabel(schedule.week_start)}</span>
            {readAt ? <span>Read {formatReadDate(readAt)}</span> : null}
            <PaperAuthors authors={paper.authors} />
          </div>
        </div>
        <PaperLogControl
          paperId={paper.id}
          pageCount={paper.page_count}
          pagesRead={pagesRead}
          status={schedule.status}
          target={{
            kind: "schedule",
            scheduleId: schedule.id,
            clubId: schedule.club_id,
          }}
        />
      </div>
      <PaperProgress pagesRead={pagesRead} totalPages={paper.page_count} />
    </article>
  );
}

function PersonalPaperRow({
  personalPaper,
  pagesRead,
}: {
  personalPaper: ProfilePersonalPaper;
  pagesRead: number;
}) {
  const paper = personalPaper.papers;
  const statusDate = personalPaper.read_at
    ? `Read ${formatReadDate(personalPaper.read_at)}`
    : `Added ${formatReadDate(personalPaper.created_at)}`;

  return (
    <article className="py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/app/personal-papers/$personalPaperId"
            params={{ personalPaperId: personalPaper.id }}
            className="truncate text-sm font-medium hover:underline"
          >
            {paper.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{paper.source_type}</Badge>
            <span>Personal</span>
            <span>{formatStatusLabel(personalPaper.status)}</span>
            <span>{formatOptionalDateLabel(personalPaper.deadline)}</span>
            <span>{statusDate}</span>
            <PaperAuthors authors={paper.authors} />
          </div>
        </div>
        <PaperLogControl
          paperId={paper.id}
          pageCount={paper.page_count}
          pagesRead={pagesRead}
          status={personalPaper.status}
          target={{
            kind: "personal",
            personalPaperId: personalPaper.id,
          }}
        />
      </div>
      <PaperProgress pagesRead={pagesRead} totalPages={paper.page_count} />
    </article>
  );
}

function PaperAuthors({ authors }: { authors: string[] }) {
  const label = formatAuthors(authors);

  if (!label) {
    return null;
  }

  return <span>{label}</span>;
}

function formatAuthors(authors: string[]) {
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

function EmptyState({ children }: { children: string }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>;
}
