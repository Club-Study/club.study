import type { User } from "@supabase/supabase-js";

import { profileValuesFromUser } from "@/features/auth/api";
import type { ArxivMetadata, Paper, PaperStatus } from "@/features/schedule/api";
import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { functionInvocationError } from "@/lib/supabase/functionError";

type PaperRow = Database["public"]["Tables"]["papers"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PersonalPaperRow = Database["public"]["Tables"]["personal_papers"]["Row"];
type ReadingSessionRow = Database["public"]["Tables"]["reading_sessions"]["Row"];
type ScheduleStatusRow = Pick<
  Database["public"]["Tables"]["schedule_paper_statuses"]["Row"],
  "schedule_id" | "status"
>;

export type Profile = ProfileRow;

export type ProfileMembership = {
  club_id: string;
  created_at: string;
  role: Database["public"]["Enums"]["club_role"];
  clubs: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
};

export type ProfileScheduledPaper = {
  id: string;
  club_id: string;
  paper_id: string;
  week_start: string | null;
  status: PaperStatus;
  created_at: string;
  clubs: {
    id: string;
    name: string;
    slug: string;
  };
  papers: Pick<
    Paper,
    | "id"
    | "abstract_url"
    | "arxiv_id"
    | "authors"
    | "external_url"
    | "pdf_url"
    | "page_count"
    | "published_at"
    | "source_type"
    | "title"
  >;
};

export type ProfileReadingLog = {
  id: string;
  read_at: string;
  schedule_id: string;
  club_paper_schedule: ProfileScheduledPaper;
};

export type ProfileReadingSession = Pick<
  ReadingSessionRow,
  "id" | "schedule_id" | "personal_paper_id" | "pages_read" | "logged_at"
>;

export type ProfilePersonalPaper = Pick<
  PersonalPaperRow,
  "id" | "paper_id" | "read_at" | "deadline" | "status" | "created_at"
> & {
  papers: Paper;
};

export type ProfileOverview = {
  memberships: ProfileMembership[];
  readingLogs: ProfileReadingLog[];
  scheduledPapers: ProfileScheduledPaper[];
  personalPapers: ProfilePersonalPaper[];
  readingSessions: ProfileReadingSession[];
};

export async function upsertProfileFromUser(user: User) {
  const values = profileValuesFromUser(user);
  await ensureProfileFromUser(user);
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: values.display_name,
      avatar_id: values.avatar_id,
      avatar_color: values.avatar_color,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfileFromUser(user: User) {
  const values = profileValuesFromUser(user);
  const { data, error } = await supabase.rpc("ensure_profile", {
    p_display_name: values.display_name,
    p_avatar_id: values.avatar_id,
    p_avatar_color: values.avatar_color,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function getProfile(userId?: string) {
  const profileUserId = userId ?? (await requireCurrentUserId());
  return getProfileById(profileUserId);
}

export async function updateProfile(
  values: Pick<
    Profile,
    "display_name" | "avatar_id" | "avatar_color" | "bio" | "is_public"
  >,
) {
  const userId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile was not updated.");
  }

  return data;
}

export async function getProfileOverview(userId?: string): Promise<ProfileOverview> {
  const profileUserId = userId ?? (await requireCurrentUserId());
  const currentUserId = await requireCurrentUserId();
  const [
    memberships,
    readingLogs,
    scheduleStatuses,
    personalPapers,
    readingSessions,
  ] = await Promise.all([
    listProfileMemberships(profileUserId),
    listProfileReadingLogs(profileUserId),
    listScheduleStatuses(profileUserId),
    listPersonalPapers(profileUserId),
    listReadingSessions(profileUserId),
  ]);
  const scheduledPapers = await listProfileScheduledPapers({
    readingLogs,
    scheduleStatuses,
    showAllVisibleSchedules: profileUserId === currentUserId,
  });

  return {
    memberships,
    readingLogs,
    scheduledPapers,
    personalPapers,
    readingSessions,
  };
}

export async function getProfileMemberships(userId: string) {
  return listProfileMemberships(userId);
}

export async function addPersonalArxivPaper(
  metadata: ArxivMetadata,
  deadline: string | null,
) {
  const { data, error } = await supabase.functions.invoke<{
    personal_paper_id: string;
  }>("arxiv-lookup", {
    body: {
      action: "personal",
      input: metadata.arxiv_id,
      deadline,
    },
  });

  if (error) {
    throw await functionInvocationError(
      error,
      "Personal arXiv paper was not created.",
    );
  }

  if (!data?.personal_paper_id) {
    throw new Error("Personal arXiv paper was not created.");
  }

  return getPersonalPaper(data.personal_paper_id);
}

export async function addPersonalManualPaper(
  metadata: {
    title: string;
    authors: string[];
    abstract: string | null;
    doi: string | null;
    license: string | null;
    external_url: string;
  },
  deadline: string | null,
) {
  const { data, error } = await supabase.rpc("add_personal_manual_paper", {
    p_metadata: metadata as unknown as Json,
    p_deadline: deadline ?? undefined,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Personal manual paper was not created.");
  }

  return getPersonalPaper(data.id);
}

export async function savePersonalReadingProgress(values: {
  personalPaperId: string;
  currentPage: number;
  totalPages: number;
  status: PaperStatus;
}) {
  const { data, error } = await supabase.rpc("save_personal_reading_progress", {
    p_personal_paper_id: values.personalPaperId,
    p_current_page: values.currentPage,
    p_total_pages: values.totalPages,
    p_status: values.status,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Personal reading progress was not saved.");
  }

  return data;
}

async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function listProfileMemberships(userId: string) {
  const { data, error } = await supabase
    .from("club_members")
    .select("club_id, created_at, role, clubs(id, name, slug, description)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile memberships query returned no data.");
  }

  const memberships = data as unknown as ProfileMembership[];

  for (const membership of memberships) {
    if (!membership.clubs) {
      throw new Error(`Missing club for membership "${membership.club_id}".`);
    }
  }

  return memberships;
}

async function listProfileReadingLogs(userId: string) {
  const { data, error } = await supabase
    .from("reading_logs")
    .select(`
      id,
      read_at,
      schedule_id,
      club_paper_schedule(
        id,
        club_id,
        paper_id,
        page_count,
        week_start,
        created_at,
        clubs(id, name, slug),
        papers(id, abstract_url, arxiv_id, authors, external_url, pdf_url, page_count, published_at, source_type, title)
      )
    `)
    .eq("user_id", userId)
    .order("read_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile reading logs query returned no data.");
  }

  return (data as unknown as ProfileReadingLogRaw[]).map((log) => {
    const schedule = normalizeProfileScheduledPaper(
      log.club_paper_schedule,
      "read",
      log.schedule_id,
    );

    return {
      id: log.id,
      read_at: log.read_at,
      schedule_id: log.schedule_id,
      club_paper_schedule: schedule,
    };
  });
}

async function listProfileScheduledPapers({
  readingLogs,
  scheduleStatuses,
  showAllVisibleSchedules,
}: {
  readingLogs: ProfileReadingLog[];
  scheduleStatuses: ScheduleStatusRow[];
  showAllVisibleSchedules: boolean;
}) {
  const schedules = showAllVisibleSchedules
    ? await listVisibleScheduledPaperRows()
    : await listVisibleScheduledPaperRowsById([
        ...new Set([
          ...scheduleStatuses.map((row) => row.schedule_id),
          ...readingLogs.map((log) => log.schedule_id),
        ]),
      ]);
  const statusByScheduleId = new Map(
    scheduleStatuses.map((row) => [row.schedule_id, row.status]),
  );

  return schedules.map((schedule) =>
    normalizeProfileScheduledPaper(
      schedule,
      statusByScheduleId.get(schedule.id) ?? "planned",
      schedule.id,
    ),
  );
}

async function listVisibleScheduledPaperRows() {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(`
      id,
      club_id,
      paper_id,
      page_count,
      week_start,
      created_at,
      clubs(id, name, slug),
      papers(id, abstract_url, arxiv_id, authors, external_url, pdf_url, page_count, published_at, source_type, title)
    `)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile scheduled papers query returned no data.");
  }

  return data as unknown as ProfileScheduledPaperRaw[];
}

async function listVisibleScheduledPaperRowsById(scheduleIds: string[]) {
  if (scheduleIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(`
      id,
      club_id,
      paper_id,
      page_count,
      week_start,
      created_at,
      clubs(id, name, slug),
      papers(id, abstract_url, arxiv_id, authors, external_url, pdf_url, page_count, published_at, source_type, title)
    `)
    .in("id", scheduleIds)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile scheduled papers query returned no data.");
  }

  return data as unknown as ProfileScheduledPaperRaw[];
}

async function listScheduleStatuses(userId: string) {
  const { data, error } = await supabase
    .from("schedule_paper_statuses")
    .select("schedule_id, status")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Schedule statuses query returned no data.");
  }

  return data as ScheduleStatusRow[];
}

async function listPersonalPapers(userId: string) {
  const { data, error } = await supabase
    .from("personal_papers")
    .select(
      "id, paper_id, page_count, read_at, deadline, status, created_at, papers(*)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Personal papers query returned no data.");
  }

  return (data as unknown as ProfilePersonalPaperRaw[]).map(
    normalizeProfilePersonalPaper,
  );
}

async function listReadingSessions(userId: string) {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("id, schedule_id, personal_paper_id, pages_read, logged_at")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Reading sessions query returned no data.");
  }

  return data;
}

async function getPersonalPaper(personalPaperId: string) {
  const { data, error } = await supabase
    .from("personal_papers")
    .select(
      "id, paper_id, page_count, read_at, deadline, status, created_at, papers(*)",
    )
    .eq("id", personalPaperId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfilePersonalPaper(data as unknown as ProfilePersonalPaperRaw);
}

async function requireCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Sign in required.");
  }

  return user.id;
}

type ProfilePaperSummary = Pick<
  Paper,
  | "id"
  | "abstract_url"
  | "arxiv_id"
  | "authors"
  | "external_url"
  | "pdf_url"
  | "page_count"
  | "published_at"
  | "source_type"
  | "title"
>;

type ProfileScheduledPaperRaw = Omit<
  ProfileScheduledPaper,
  "status" | "papers"
> & {
  page_count?: number | null;
  clubs: ProfileScheduledPaper["clubs"] | null;
  papers: Pick<
    PaperRow,
    | "id"
    | "abstract_url"
    | "arxiv_id"
    | "authors"
    | "external_url"
    | "pdf_url"
    | "page_count"
    | "published_at"
    | "source_type"
    | "title"
  > | null;
};

type ProfileReadingLogRaw = Pick<
  ProfileReadingLog,
  "id" | "read_at" | "schedule_id"
> & {
  club_paper_schedule: ProfileScheduledPaperRaw | null;
};

type ProfilePersonalPaperRaw = Pick<
  ProfilePersonalPaper,
  "id" | "paper_id" | "read_at" | "deadline" | "status" | "created_at"
> & {
  page_count?: number | null;
  papers: PaperRow | null;
};

function normalizeProfileScheduledPaper(
  row: ProfileScheduledPaperRaw | null,
  status: PaperStatus,
  id: string,
): ProfileScheduledPaper {
  if (!row) {
    throw new Error(`Missing schedule "${id}".`);
  }

  if (!row.clubs) {
    throw new Error(`Missing club for schedule "${row.id}".`);
  }

  if (!row.papers) {
    throw new Error(`Missing paper for schedule "${row.id}".`);
  }

  return {
    id: row.id,
    club_id: row.club_id,
    paper_id: row.paper_id,
    week_start: row.week_start,
    status,
    created_at: row.created_at,
    clubs: row.clubs,
    papers: normalizeProfilePaperSummary(
      row.papers,
      row.paper_id,
      row.page_count,
    ),
  };
}

function normalizeProfilePersonalPaper(
  row: ProfilePersonalPaperRaw,
): ProfilePersonalPaper {
  if (!row.papers) {
    throw new Error(`Missing paper for personal paper "${row.id}".`);
  }

  return {
    id: row.id,
    paper_id: row.paper_id,
    read_at: row.read_at,
    deadline: row.deadline,
    status: row.status,
    created_at: row.created_at,
    papers: normalizePaper(row.papers, row.paper_id, row.page_count),
  };
}

function normalizeProfilePaperSummary(
  row: ProfileScheduledPaperRaw["papers"],
  id: string,
  contextPageCount?: number | null,
): ProfilePaperSummary {
  if (!row) {
    throw new Error(`Missing paper "${id}".`);
  }

  return {
    id: row.id,
    abstract_url: row.abstract_url,
    arxiv_id: row.arxiv_id,
    authors: stringArray(row.authors, `paper "${row.id}" authors`),
    external_url: row.external_url,
    pdf_url: row.pdf_url,
    page_count:
      contextPageCount === undefined ? row.page_count : contextPageCount,
    published_at: row.published_at,
    source_type: row.source_type,
    title: row.title,
  };
}

function normalizePaper(
  row: PaperRow,
  id: string,
  contextPageCount?: number | null,
): Paper {
  return {
    ...row,
    id: row.id || id,
    page_count:
      contextPageCount === undefined ? row.page_count : contextPageCount,
    authors: stringArray(row.authors, `paper "${row.id}" authors`),
  };
}

function stringArray(value: Json, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${label} must contain only strings.`);
    }

    return item;
  });
}
