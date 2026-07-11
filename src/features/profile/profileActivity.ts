import type {
  ProfileOverview,
  ProfilePersonalPaper,
  ProfileReadingLog,
  ProfileReadingSession,
  ProfileScheduledPaper,
} from "@/features/profile/api";
import { toDateInputValue } from "@/lib/dates/week";

export type ProfileActivity = {
  readCount: number;
  readingCount: number;
  plannedCount: number;
  contributionCells: number[];
};

export type ProfilePaperBuckets = {
  readLogs: ProfileReadingLog[];
  readPersonalPapers: Array<ProfilePersonalPaper & { read_at: string }>;
  readingPersonalPapers: ProfilePersonalPaper[];
  plannedPersonalPapers: ProfilePersonalPaper[];
  onHoldPersonalPapers: ProfilePersonalPaper[];
  droppedPersonalPapers: ProfilePersonalPaper[];
  readingSchedules: ProfileScheduledPaper[];
  plannedSchedules: ProfileScheduledPaper[];
  onHoldSchedules: ProfileScheduledPaper[];
  droppedSchedules: ProfileScheduledPaper[];
  pagesReadByScheduleId: Record<string, number>;
  pagesReadByPersonalPaperId: Record<string, number>;
};

export function buildProfileActivity(overview: ProfileOverview): ProfileActivity {
  const buckets = buildProfilePaperBuckets(overview);

  return {
    readCount: buckets.readLogs.length + buckets.readPersonalPapers.length,
    readingCount:
      buckets.readingSchedules.length + buckets.readingPersonalPapers.length,
    plannedCount:
      buckets.plannedSchedules.length + buckets.plannedPersonalPapers.length,
    contributionCells: buildContributionCells(overview.readingSessions),
  };
}

export function buildProfilePaperBuckets(overview: ProfileOverview): ProfilePaperBuckets {
  const readScheduleIds = new Set(overview.readingLogs.map((log) => log.schedule_id));
  const pagesReadByScheduleId = totalPagesByKey(
    overview.readingSessions,
    "schedule_id",
  );
  const pagesReadByPersonalPaperId = totalPagesByKey(
    overview.readingSessions,
    "personal_paper_id",
  );
  const unreadSchedules = overview.scheduledPapers.filter(
    (schedule) => !readScheduleIds.has(schedule.id),
  );
  const unreadPersonalPapers = overview.personalPapers.filter(
    (paper) => paper.status !== "read",
  );

  return {
    readLogs: overview.readingLogs,
    readPersonalPapers: sortPersonalPapersByReadDateDescending(
      overview.personalPapers.filter(hasReadStatus),
    ),
    readingPersonalPapers: sortPersonalPapersByCreatedDateDescending(
      unreadPersonalPapers.filter((paper) => paper.status === "reading"),
    ),
    plannedPersonalPapers: sortPersonalPapersByCreatedDateDescending(
      unreadPersonalPapers.filter((paper) => paper.status === "planned"),
    ),
    onHoldPersonalPapers: sortPersonalPapersByCreatedDateDescending(
      unreadPersonalPapers.filter((paper) => paper.status === "on_hold"),
    ),
    droppedPersonalPapers: sortPersonalPapersByCreatedDateDescending(
      unreadPersonalPapers.filter((paper) => paper.status === "dropped"),
    ),
    readingSchedules: sortSchedulesDescending(
      unreadSchedules.filter((schedule) => schedule.status === "reading"),
    ),
    plannedSchedules: sortSchedulesAscending(
      unreadSchedules.filter((schedule) => schedule.status === "planned"),
    ),
    onHoldSchedules: sortSchedulesDescending(
      unreadSchedules.filter((schedule) => schedule.status === "on_hold"),
    ),
    droppedSchedules: sortSchedulesDescending(
      unreadSchedules.filter((schedule) => schedule.status === "dropped"),
    ),
    pagesReadByScheduleId,
    pagesReadByPersonalPaperId,
  };
}

export function contributionColor(level: number) {
  if (level === 0) {
    return "var(--muted)";
  }

  if (level === 1) {
    return "oklch(0.82 0.12 145)";
  }

  if (level === 2) {
    return "oklch(0.68 0.16 145)";
  }

  if (level === 3) {
    return "oklch(0.54 0.17 145)";
  }

  return "oklch(0.42 0.15 145)";
}

function buildContributionCells(sessions: ProfileReadingSession[]) {
  const weeks = 52;
  const days = weeks * 7;
  const end = startOfUtcDay(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const pagesByDay = new Map<string, number>();

  for (const session of sessions) {
    const date = new Date(session.logged_at);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid session timestamp "${session.logged_at}".`);
    }

    const key = toDateInputValue(date);
    pagesByDay.set(key, (pagesByDay.get(key) ?? 0) + session.pages_read);
  }

  return Array.from({ length: days }, (_, index) => {
    const week = index % weeks;
    const day = Math.floor(index / weeks);
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * 7 + day);

    return contributionLevel(pagesByDay.get(toDateInputValue(date)) ?? 0);
  });
}

function contributionLevel(pages: number) {
  if (pages >= 30) {
    return 4;
  }

  if (pages >= 15) {
    return 3;
  }

  if (pages >= 5) {
    return 2;
  }

  if (pages >= 1) {
    return 1;
  }

  return 0;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function sortSchedulesDescending(schedules: ProfileScheduledPaper[]) {
  return [...schedules].sort((left, right) =>
    compareOptionalDateDescending(left.week_start, right.week_start),
  );
}

function sortSchedulesAscending(schedules: ProfileScheduledPaper[]) {
  return [...schedules].sort((left, right) =>
    compareOptionalDateAscending(left.week_start, right.week_start),
  );
}

function compareOptionalDateDescending(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right.localeCompare(left);
}

function compareOptionalDateAscending(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left.localeCompare(right);
}

function sortPersonalPapersByCreatedDateDescending(papers: ProfilePersonalPaper[]) {
  return [...papers].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
}

function sortPersonalPapersByReadDateDescending(
  papers: Array<ProfilePersonalPaper & { read_at: string }>,
) {
  return [...papers].sort((left, right) => right.read_at.localeCompare(left.read_at));
}

function hasReadStatus(
  paper: ProfilePersonalPaper,
): paper is ProfilePersonalPaper & { read_at: string } {
  return paper.status === "read" && paper.read_at !== null;
}

function totalPagesByKey(
  sessions: ProfileReadingSession[],
  key: "schedule_id" | "personal_paper_id",
) {
  const pagesByKey: Record<string, number> = {};

  for (const session of sessions) {
    const value = session[key];

    if (value === null) {
      continue;
    }

    pagesByKey[value] = (pagesByKey[value] ?? 0) + session.pages_read;
  }

  return pagesByKey;
}
