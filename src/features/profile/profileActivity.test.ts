import { describe, expect, it } from "vitest";

import type {
  ProfileOverview,
  ProfilePersonalPaper,
  ProfileReadingLog,
  ProfileReadingSession,
  ProfileScheduledPaper,
} from "@/features/profile/api";
import {
  buildProfileActivity,
  buildProfilePaperBuckets,
} from "@/features/profile/profileActivity";

describe("profile activity", () => {
  it("buckets papers by explicit read status and logged sessions", () => {
    const readSchedule = scheduledPaper("read", "2026-06-22", "read");
    const readingSchedule = scheduledPaper("started", "2026-07-06", "reading");
    const onHoldSchedule = scheduledPaper("paused", "2026-07-13", "on_hold");
    const droppedSchedule = scheduledPaper("dropped", "2026-07-27", "dropped");
    const overview: ProfileOverview = {
      memberships: [],
      readingLogs: [readingLog("read-log", readSchedule)],
      scheduledPapers: [
        scheduledPaper("later", "2026-07-20"),
        scheduledPaper("past", "2026-06-29"),
        droppedSchedule,
        onHoldSchedule,
        readingSchedule,
        readSchedule,
      ],
      personalPapers: [
        personalPaper("personal-planned", null),
        personalPaper("personal-reading", null, "reading"),
        personalPaper("personal-paused", null, "on_hold"),
        personalPaper("personal-dropped", null, "dropped"),
        personalPaper("personal-read", "2026-07-04T09:00:00Z", "read"),
      ],
      readingSessions: [
        readingSession({
          id: "schedule-session",
          scheduleId: readingSchedule.id,
          personalPaperId: null,
          pagesRead: 12,
        }),
        readingSession({
          id: "personal-session",
          scheduleId: null,
          personalPaperId: "personal-reading",
          pagesRead: 8,
        }),
      ],
    };

    const buckets = buildProfilePaperBuckets(overview);
    const activity = buildProfileActivity(overview);

    expect(buckets.readLogs.map((log) => log.id)).toEqual(["read-log"]);
    expect(buckets.readingSchedules.map((schedule) => schedule.id)).toEqual([
      "started",
    ]);
    expect(buckets.plannedSchedules.map((schedule) => schedule.id)).toEqual([
      "past",
      "later",
    ]);
    expect(buckets.onHoldSchedules.map((schedule) => schedule.id)).toEqual([
      "paused",
    ]);
    expect(buckets.droppedSchedules.map((schedule) => schedule.id)).toEqual([
      "dropped",
    ]);
    expect(buckets.readingPersonalPapers.map((paper) => paper.id)).toEqual([
      "personal-reading",
    ]);
    expect(buckets.plannedPersonalPapers.map((paper) => paper.id)).toEqual([
      "personal-planned",
    ]);
    expect(buckets.readPersonalPapers.map((paper) => paper.id)).toEqual([
      "personal-read",
    ]);
    expect(buckets.onHoldPersonalPapers.map((paper) => paper.id)).toEqual([
      "personal-paused",
    ]);
    expect(buckets.droppedPersonalPapers.map((paper) => paper.id)).toEqual([
      "personal-dropped",
    ]);
    expect(buckets.pagesReadByScheduleId).toEqual({ started: 12 });
    expect(buckets.pagesReadByPersonalPaperId).toEqual({
      "personal-reading": 8,
    });
    expect(activity).toMatchObject({
      readCount: 2,
      readingCount: 2,
      plannedCount: 3,
    });
  });
});

function scheduledPaper(
  id: string,
  weekStart: string,
  status: ProfileScheduledPaper["status"] = "planned",
): ProfileScheduledPaper {
  return {
    id,
    club_id: "club",
    paper_id: `paper-${id}`,
    week_start: weekStart,
    status,
    created_at: "2026-07-03T12:00:00Z",
    clubs: {
      id: "club",
      name: "Study Club",
      slug: "study-club",
    },
    papers: {
      id: `paper-${id}`,
      abstract_url: null,
      arxiv_id: null,
      authors: ["Ada Lovelace", "Emmy Noether"],
      external_url: "https://example.com/paper",
      pdf_url: null,
      page_count: null,
      published_at: null,
      source_type: "manual",
      title: `Paper ${id}`,
    },
  };
}

function personalPaper(
  id: string,
  readAt: string | null,
  status: ProfilePersonalPaper["status"] = "planned",
): ProfilePersonalPaper {
  return {
    id,
    paper_id: `paper-${id}`,
    read_at: readAt,
    deadline: null,
    status,
    created_at: "2026-07-03T12:00:00Z",
    papers: {
      id: `paper-${id}`,
      source_type: "manual",
      title: `Personal paper ${id}`,
      authors: ["Ada Lovelace"],
      abstract: null,
      doi: null,
      license: null,
      arxiv_id: null,
      abstract_url: null,
      pdf_url: null,
      external_url: "https://example.com/paper",
      page_count: null,
      published_at: null,
      source_updated_at: null,
      created_at: "2026-07-03T12:00:00Z",
      updated_at: "2026-07-03T12:00:00Z",
    },
  };
}

function readingLog(
  id: string,
  schedule: ProfileScheduledPaper,
): ProfileReadingLog {
  return {
    id,
    read_at: "2026-07-03T12:00:00Z",
    schedule_id: schedule.id,
    club_paper_schedule: schedule,
  };
}

function readingSession({
  id,
  scheduleId,
  personalPaperId,
  pagesRead,
}: {
  id: string;
  scheduleId: string | null;
  personalPaperId: string | null;
  pagesRead: number;
}): ProfileReadingSession {
  return {
    id,
    schedule_id: scheduleId,
    personal_paper_id: personalPaperId,
    pages_read: pagesRead,
    logged_at: "2026-07-03T12:00:00Z",
  };
}
