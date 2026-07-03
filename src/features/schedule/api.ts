import { apiRequest } from "@/lib/api/client";

export type PaperStatus = "planned" | "reading" | "on_hold" | "dropped" | "read";

export type Paper = {
  id: string;
  source_type: "arxiv" | "manual";
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  license: string | null;
  arxiv_id: string | null;
  abstract_url: string | null;
  pdf_url: string | null;
  external_url: string | null;
  page_count: number | null;
  published_at: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Schedule = {
  id: string;
  club_id: string;
  paper_id: string;
  week_start: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type ScheduleWithPaper = Schedule & {
  papers: Paper | null;
  clubs?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  suggested_by?: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
  } | null;
};

export type ScheduleProgress = {
  schedule_id: string;
  total_members: number;
  read_count: number;
  current_user_read: boolean;
  current_user_status: PaperStatus;
  current_user_pages_read: number;
  current_user_session_count: number;
};

export type ArxivMetadata = {
  title: string;
  authors: string[];
  abstract: string | null;
  arxiv_id: string;
  doi: string | null;
  license: string | null;
  abstract_url: string;
  pdf_url: string;
  published_at: string | null;
  updated_at: string | null;
};

export async function listClubSchedule(clubId: string) {
  return apiRequest<ScheduleWithPaper[]>(`api/clubs/${clubId}/schedule/`);
}

export async function listDashboardSchedule(fromWeekStart: string) {
  return apiRequest<ScheduleWithPaper[]>("api/dashboard/schedule/", {
    query: { from_week_start: fromWeekStart },
  });
}

export async function getSchedule(clubId: string, scheduleId: string) {
  return apiRequest<ScheduleWithPaper>(
    `api/clubs/${clubId}/schedule/${scheduleId}/`,
  );
}

export async function getScheduleById(scheduleId: string) {
  return apiRequest<ScheduleWithPaper>(`api/schedule/${scheduleId}/`);
}

export async function getClubProgress(clubId: string) {
  return apiRequest<ScheduleProgress[]>(
    `api/clubs/${clubId}/schedule/progress/`,
  );
}

export async function lookupArxivMetadata(input: string) {
  return apiRequest<ArxivMetadata>("api/arxiv/lookup/", {
    method: "POST",
    body: { input },
  });
}

export async function scheduleArxivPaper(values: {
  clubId: string;
  deadline: string | null;
  metadata: ArxivMetadata;
}) {
  return apiRequest<ScheduleWithPaper>(
    `api/clubs/${values.clubId}/schedule/arxiv/`,
    {
      method: "POST",
      body: {
        week_start: values.deadline,
        metadata: values.metadata,
        notes: null,
      },
    },
  );
}

export async function scheduleManualPaper(values: {
  clubId: string;
  deadline: string | null;
  metadata: {
    title: string;
    authors: string[];
    abstract: string | null;
    doi: string | null;
    license: string | null;
    external_url: string;
  };
}) {
  return apiRequest<ScheduleWithPaper>(
    `api/clubs/${values.clubId}/schedule/manual/`,
    {
      method: "POST",
      body: {
        week_start: values.deadline,
        metadata: values.metadata,
        notes: null,
      },
    },
  );
}

export async function scheduleExistingPaper(values: {
  clubId: string;
  deadline: string | null;
  paperId: string;
}) {
  return apiRequest<ScheduleWithPaper>(
    `api/clubs/${values.clubId}/schedule/existing/`,
    {
      method: "POST",
      body: {
        week_start: values.deadline,
        paper_id: values.paperId,
        notes: null,
      },
    },
  );
}

export async function toggleReadStatus(scheduleId: string, read: boolean) {
  return apiRequest<{
    schedule_id: string;
    read: boolean;
    reading_log_id: string | null;
  }>(`api/schedule/${scheduleId}/read-status/`, {
    method: "POST",
    body: { read },
  });
}

export async function setSchedulePaperStatus(
  scheduleId: string,
  status: PaperStatus,
) {
  return apiRequest<{
    schedule_id: string;
    status: PaperStatus;
    read: boolean;
    reading_log_id: string | null;
  }>(`api/schedule/${scheduleId}/status/`, {
    method: "POST",
    body: { status },
  });
}

export async function updatePaperPageCount(paperId: string, pageCount: number) {
  return apiRequest<Paper>(`api/papers/${paperId}/page-count/`, {
    method: "PATCH",
    body: { page_count: pageCount },
  });
}

export async function logScheduleReadingSession(
  scheduleId: string,
  pagesRead: number,
) {
  return apiRequest<{
    id: string;
    schedule_id: string;
    personal_paper_id: null;
    pages_read: number;
    logged_at: string;
  }>(`api/schedule/${scheduleId}/reading-sessions/`, {
    method: "POST",
    body: { pages_read: pagesRead },
  });
}
