import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarClock, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { LogReadingSessionDialog } from "@/components/log-reading-session-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddPersonalPaperDialog } from "@/features/profile/components/AddPersonalPaperDialog";
import type {
  ProfileOverview,
  ProfilePersonalPaper,
  ProfileReadingLog,
  ProfileScheduledPaper,
} from "@/features/profile/api";
import {
  logPersonalPaperReadingSession,
  setPersonalPaperStatus,
} from "@/features/profile/api";
import { buildProfilePaperBuckets } from "@/features/profile/profileActivity";
import {
  logScheduleReadingSession,
  setSchedulePaperStatus,
  updatePaperPageCount,
  type PaperStatus,
} from "@/features/schedule/api";
import { formatOptionalDateLabel } from "@/lib/dates/week";
import { queryKeys } from "@/lib/queryKeys";

type PaperListView = "reading" | "planned" | "on_hold" | "dropped" | "read";

type PaperRow =
  | {
      kind: "readLog";
      key: string;
      sortKey: string;
      pagesRead: number;
      log: ProfileReadingLog;
    }
  | {
      kind: "scheduled";
      key: string;
      sortKey: string;
      pagesRead: number;
      schedule: ProfileScheduledPaper;
    }
  | {
      kind: "personal";
      key: string;
      sortKey: string;
      pagesRead: number;
      personalPaper: ProfilePersonalPaper;
    };

const paperListViews: Array<{
  id: PaperListView;
  label: string;
  description: string;
  empty: string;
  Icon: typeof BookOpen;
}> = [
  {
    id: "reading",
    label: "Reading",
    description: "Papers with logged reading sessions.",
    empty: "No current reading papers.",
    Icon: BookOpen,
  },
  {
    id: "planned",
    label: "Planned",
    description: "Papers you have not started yet.",
    empty: "No planned papers yet.",
    Icon: CalendarClock,
  },
  {
    id: "on_hold",
    label: "On hold",
    description: "Papers paused for later.",
    empty: "No papers on hold.",
    Icon: CalendarClock,
  },
  {
    id: "dropped",
    label: "Dropped",
    description: "Papers you stopped reading.",
    empty: "No dropped papers.",
    Icon: CalendarClock,
  },
  {
    id: "read",
    label: "Read",
    description: "Papers marked read across your profile and clubs.",
    empty: "No papers read yet.",
    Icon: CheckCircle2,
  },
];

export function RecentReadsCard({
  overview,
}: {
  overview: ProfileOverview;
}) {
  const [view, setView] = useState<PaperListView>("reading");
  const buckets = useMemo(() => buildProfilePaperBuckets(overview), [overview]);
  const activeView = paperListViews.find((item) => item.id === view);

  if (!activeView) {
    throw new Error(`Unknown profile paper list view: ${view}`);
  }

  const count = getViewCount(view, buckets);

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium">Papers</h2>
            <span className="text-xs text-muted-foreground">{count} total</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeView.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AddPersonalPaperDialog />
          <div
            className="flex items-center gap-0.5 rounded-md border bg-muted/10 p-0.5"
            role="tablist"
            aria-label="Profile paper status"
          >
            {paperListViews.map(({ id, label, Icon }) => (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-label={label}
                title={label}
                aria-selected={view === id}
                aria-controls="profile-paper-panel"
                id={`profile-paper-tab-${id}`}
                variant="ghost"
                size="xs"
                className="h-6 min-w-0 gap-1 rounded-sm px-1.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-xs [&_svg:not([class*='size-'])]:size-3"
                onClick={() => setView(id)}
              >
                <Icon aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div
        id="profile-paper-panel"
        role="tabpanel"
        aria-labelledby={`profile-paper-tab-${view}`}
        className="mt-3 divide-y"
      >
        <PaperRows view={view} buckets={buckets} empty={activeView.empty} />
      </div>
    </section>
  );
}

function PaperRows({
  view,
  buckets,
  empty,
}: {
  view: PaperListView;
  buckets: ReturnType<typeof buildProfilePaperBuckets>;
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
  const schedule = log.club_paper_schedule;

  return (
    <ScheduledPaperRow
      schedule={schedule}
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
  const statusLabel = formatStatusLabel(personalPaper.status);

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
            <span>{statusLabel}</span>
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

type PaperLogTarget =
  | {
      kind: "schedule";
      scheduleId: string;
      clubId: string;
    }
  | {
      kind: "personal";
      personalPaperId: string;
    };

function PaperLogControl({
  paperId,
  pageCount,
  pagesRead,
  status,
  target,
}: {
  paperId: string;
  pageCount: number | null;
  pagesRead: number;
  status: PaperStatus;
  target: PaperLogTarget;
}) {
  const queryClient = useQueryClient();
  const updatePageCount = useMutation<unknown, Error, number>({
    mutationFn: (totalPages: number) =>
      updatePaperPageCount(paperId, totalPages),
  });
  const logSession = useMutation<unknown, Error, number>({
    mutationFn: (pages: number) => {
      if (target.kind === "personal") {
        return logPersonalPaperReadingSession(target.personalPaperId, pages);
      }

      return logScheduleReadingSession(target.scheduleId, pages);
    },
  });
  const updateStatus = useMutation<unknown, Error, PaperStatus>({
    mutationFn: (nextStatus: PaperStatus) => {
      if (target.kind === "personal") {
        return setPersonalPaperStatus(target.personalPaperId, nextStatus);
      }

      return setSchedulePaperStatus(target.scheduleId, nextStatus);
    },
  });

  async function saveReadingProgress(values: {
    currentPage: number;
    totalPages: number;
    status: PaperStatus;
  }) {
    if (pageCount !== values.totalPages) {
      await updatePageCount.mutateAsync(values.totalPages);
    }

    const pagesToLog = values.currentPage - pagesRead;

    if (pagesToLog < 0) {
      throw new Error("Current page cannot be less than your logged page count.");
    }

    if (pagesToLog > 0) {
      await logSession.mutateAsync(pagesToLog);
    }

    const nextStatus =
      pagesToLog > 0 && values.status !== "read" ? "reading" : values.status;

    if (nextStatus !== status) {
      await updateStatus.mutateAsync(nextStatus);
    }

    await invalidatePaperQueries(queryClient, target);
    toast.success("Reading progress updated");
  }

  return (
    <LogReadingSessionDialog
      currentPagesRead={pagesRead}
      totalPages={pageCount}
      status={status}
      triggerLabel="Log"
      triggerSize="xs"
      triggerClassName="self-start text-muted-foreground"
      disabled={
        updatePageCount.isPending || logSession.isPending || updateStatus.isPending
      }
      onSave={saveReadingProgress}
    />
  );
}

async function invalidatePaperQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  target: PaperLogTarget,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.root }),
  ];

  if (target.kind === "schedule") {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.dashboardRoot,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.list(target.clubId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.progress(target.clubId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.detail(target.clubId, target.scheduleId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.detailById(target.scheduleId),
      }),
    );
  }

  await Promise.all(invalidations);
}

function PaperProgress({
  pagesRead,
  totalPages,
}: {
  pagesRead: number;
  totalPages: number | null;
}) {
  if (totalPages === null) {
    if (pagesRead === 0) {
      return null;
    }

    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {pagesRead} pages logged
      </p>
    );
  }

  if (totalPages < 1) {
    throw new Error(`Invalid total page count "${totalPages}".`);
  }

  if (pagesRead > totalPages) {
    throw new Error(
      `Logged page count "${pagesRead}" exceeds total page count "${totalPages}".`,
    );
  }

  const percentage = Math.round((pagesRead / totalPages) * 100);

  return (
    <div className="mt-2 max-w-md">
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          {pagesRead} of {totalPages} pages
        </span>
        <span>{percentage}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={totalPages}
        aria-valuenow={pagesRead}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
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

function getViewCount(
  view: PaperListView,
  buckets: ReturnType<typeof buildProfilePaperBuckets>,
) {
  if (view === "reading") {
    return buckets.readingSchedules.length + buckets.readingPersonalPapers.length;
  }

  if (view === "planned") {
    return buckets.plannedSchedules.length + buckets.plannedPersonalPapers.length;
  }

  if (view === "on_hold") {
    return buckets.onHoldSchedules.length + buckets.onHoldPersonalPapers.length;
  }

  if (view === "dropped") {
    return buckets.droppedSchedules.length + buckets.droppedPersonalPapers.length;
  }

  return buckets.readLogs.length + buckets.readPersonalPapers.length;
}

function getPaperRows(
  view: PaperListView,
  buckets: ReturnType<typeof buildProfilePaperBuckets>,
): PaperRow[] {
  if (view === "planned") {
    return sortRowsDescending([
      ...buckets.plannedPersonalPapers.map((personalPaper) => ({
        kind: "personal" as const,
        key: `personal-${personalPaper.id}`,
        sortKey: personalPaper.created_at,
        pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
        personalPaper,
      })),
      ...buckets.plannedSchedules.map((schedule) => ({
        kind: "scheduled" as const,
        key: `schedule-${schedule.id}`,
        sortKey: schedule.week_start ?? "",
        pagesRead: buckets.pagesReadByScheduleId[schedule.id] ?? 0,
        schedule,
      })),
    ]);
  }

  if (view === "read") {
    return sortRowsDescending([
      ...buckets.readLogs.map((log) => ({
        kind: "readLog" as const,
        key: `read-log-${log.id}`,
        sortKey: log.read_at,
        pagesRead: buckets.pagesReadByScheduleId[log.schedule_id] ?? 0,
        log,
      })),
      ...buckets.readPersonalPapers.map((personalPaper) => ({
        kind: "personal" as const,
        key: `personal-${personalPaper.id}`,
        sortKey: personalPaper.read_at,
        pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
        personalPaper,
      })),
    ]);
  }

  if (view === "on_hold") {
    return sortRowsDescending([
      ...buckets.onHoldPersonalPapers.map((personalPaper) => ({
        kind: "personal" as const,
        key: `personal-${personalPaper.id}`,
        sortKey: personalPaper.created_at,
        pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
        personalPaper,
      })),
      ...buckets.onHoldSchedules.map((schedule) => ({
        kind: "scheduled" as const,
        key: `schedule-${schedule.id}`,
        sortKey: schedule.week_start ?? "",
        pagesRead: buckets.pagesReadByScheduleId[schedule.id] ?? 0,
        schedule,
      })),
    ]);
  }

  if (view === "dropped") {
    return sortRowsDescending([
      ...buckets.droppedPersonalPapers.map((personalPaper) => ({
        kind: "personal" as const,
        key: `personal-${personalPaper.id}`,
        sortKey: personalPaper.created_at,
        pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
        personalPaper,
      })),
      ...buckets.droppedSchedules.map((schedule) => ({
        kind: "scheduled" as const,
        key: `schedule-${schedule.id}`,
        sortKey: schedule.week_start ?? "",
        pagesRead: buckets.pagesReadByScheduleId[schedule.id] ?? 0,
        schedule,
      })),
    ]);
  }

  return sortRowsDescending([
    ...buckets.readingPersonalPapers.map((personalPaper) => ({
      kind: "personal" as const,
      key: `personal-${personalPaper.id}`,
      sortKey: personalPaper.created_at,
      pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
      personalPaper,
    })),
    ...buckets.readingSchedules.map((schedule) => ({
      kind: "scheduled" as const,
      key: `schedule-${schedule.id}`,
      sortKey: schedule.week_start ?? "",
      pagesRead: buckets.pagesReadByScheduleId[schedule.id] ?? 0,
      schedule,
    })),
  ]);
}

function sortRowsDescending(rows: PaperRow[]) {
  return [...rows].sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

function formatReadDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid read timestamp "${value}".`);
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatStatusLabel(status: ProfileScheduledPaper["status"]) {
  if (status === "on_hold") {
    return "On hold";
  }

  if (status === "read") {
    return "Read";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}
