import { BookOpen, CalendarClock, CheckCircle2 } from "lucide-react";

import type {
  ProfilePersonalPaper,
  ProfileReadingLog,
  ProfileScheduledPaper,
} from "@/features/profile/api";
import type { ProfilePaperBuckets } from "@/features/profile/profileActivity";

export type PaperListView = "reading" | "planned" | "on_hold" | "dropped" | "read";

export type PaperRow =
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

export const paperListViews: Array<{
  id: PaperListView;
  label: string;
  empty: string;
  Icon: typeof BookOpen;
}> = [
  {
    id: "reading",
    label: "Reading",
    empty: "No current reading papers.",
    Icon: BookOpen,
  },
  {
    id: "planned",
    label: "Planned",
    empty: "No planned papers yet.",
    Icon: CalendarClock,
  },
  {
    id: "on_hold",
    label: "On hold",
    empty: "No papers on hold.",
    Icon: CalendarClock,
  },
  {
    id: "dropped",
    label: "Dropped",
    empty: "No dropped papers.",
    Icon: CalendarClock,
  },
  {
    id: "read",
    label: "Read",
    empty: "No papers read yet.",
    Icon: CheckCircle2,
  },
];

export function getViewCount(
  view: PaperListView,
  buckets: ProfilePaperBuckets,
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

export function getPaperRows(
  view: PaperListView,
  buckets: ProfilePaperBuckets,
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
      ...buckets.plannedSchedules.map((schedule) => scheduleRow(schedule, buckets)),
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
      ...buckets.onHoldPersonalPapers.map((personalPaper) => personalRow(personalPaper, buckets)),
      ...buckets.onHoldSchedules.map((schedule) => scheduleRow(schedule, buckets)),
    ]);
  }

  if (view === "dropped") {
    return sortRowsDescending([
      ...buckets.droppedPersonalPapers.map((personalPaper) => personalRow(personalPaper, buckets)),
      ...buckets.droppedSchedules.map((schedule) => scheduleRow(schedule, buckets)),
    ]);
  }

  return sortRowsDescending([
    ...buckets.readingPersonalPapers.map((personalPaper) => personalRow(personalPaper, buckets)),
    ...buckets.readingSchedules.map((schedule) => scheduleRow(schedule, buckets)),
  ]);
}

export function formatReadDate(value: string) {
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

export function formatStatusLabel(status: ProfileScheduledPaper["status"]) {
  if (status === "on_hold") {
    return "On hold";
  }

  if (status === "read") {
    return "Read";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function personalRow(
  personalPaper: ProfilePersonalPaper,
  buckets: ProfilePaperBuckets,
): PaperRow {
  return {
    kind: "personal",
    key: `personal-${personalPaper.id}`,
    sortKey: personalPaper.created_at,
    pagesRead: buckets.pagesReadByPersonalPaperId[personalPaper.id] ?? 0,
    personalPaper,
  };
}

function scheduleRow(
  schedule: ProfileScheduledPaper,
  buckets: ProfilePaperBuckets,
): PaperRow {
  return {
    kind: "scheduled",
    key: `schedule-${schedule.id}`,
    sortKey: schedule.week_start ?? "",
    pagesRead: buckets.pagesReadByScheduleId[schedule.id] ?? 0,
    schedule,
  };
}

function sortRowsDescending(rows: PaperRow[]) {
  return [...rows].sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}
