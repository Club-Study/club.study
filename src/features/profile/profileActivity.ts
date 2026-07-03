import type { ProfileOverview, ProfileReadingLog } from "@/features/profile/api";
import { getCurrentWeekStart, toDateInputValue } from "@/lib/dates/week";

export type ProfileActivity = {
  readCount: number;
  readingCount: number;
  plannedCount: number;
  contributionCells: number[];
};

export function buildProfileActivity(
  overview: ProfileOverview,
): ProfileActivity {
  const currentWeekStart = getCurrentWeekStart();
  const readScheduleIds = new Set(overview.readingLogs.map((log) => log.schedule_id));
  const unreadSchedules = overview.scheduledPapers.filter(
    (schedule) => !readScheduleIds.has(schedule.id),
  );
  const readingCount = unreadSchedules.filter(
    (schedule) => schedule.week_start <= currentWeekStart,
  ).length;
  const plannedCount = unreadSchedules.length - readingCount;

  return {
    readCount: overview.readingLogs.length,
    readingCount,
    plannedCount,
    contributionCells: buildContributionCells(overview.readingLogs),
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

function buildContributionCells(logs: ProfileReadingLog[]) {
  const days = 49 * 7;
  const end = startOfUtcDay(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const readsByDay = new Map<string, number>();

  for (const log of logs) {
    const date = new Date(log.read_at);

    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid read timestamp "${log.read_at}".`);
    }

    const key = toDateInputValue(date);
    readsByDay.set(key, (readsByDay.get(key) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const week = index % 49;
    const day = Math.floor(index / 49);
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * 7 + day);

    return contributionLevel(readsByDay.get(toDateInputValue(date)) ?? 0);
  });
}

function contributionLevel(count: number) {
  if (count >= 4) {
    return 4;
  }

  return count;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
