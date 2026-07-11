import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";
import { functionInvocationError } from "@/lib/supabase/functionError";

import { normalizeFeedSearch } from "@/features/dashboard/feed";

type PaperRow = Database["public"]["Tables"]["papers"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["club_paper_schedule"]["Row"];

export type PaperStatus = Database["public"]["Enums"]["paper_status"];

export type Paper = Omit<PaperRow, "authors"> & {
  authors: string[];
};

export type Schedule = ScheduleRow;

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

export type FeedScope = "upcoming" | "past";

export type FeedFilters = {
  clubId: string | null;
  search: string;
};

export type DashboardFeedItem = ScheduleWithPaper & {
  currentStatus: PaperStatus | null;
};

export type ScheduleProgress =
  Database["public"]["Functions"]["get_club_schedule_progress"]["Returns"][number];

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
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name, avatar_id, avatar_color)",
    )
    .eq("club_id", clubId)
    .order("week_start", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club schedule query returned no data.");
  }

  return (data as unknown as ScheduleWithPaperRaw[]).map(normalizeSchedule);
}

export async function listDashboardFeed({
  userId,
  scope,
  currentWeekStart,
  filters,
}: {
  userId: string;
  scope: FeedScope;
  currentWeekStart: string;
  filters: FeedFilters;
}) {
  const search = normalizeFeedSearch(filters.search);
  const papersRelation = search ? "papers!inner(*)" : "papers(*)";
  const query = supabase
    .from("club_paper_schedule")
    .select(
      `*, ${papersRelation}, clubs!inner(id, name, slug, club_members!inner(user_id)), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name, avatar_id, avatar_color), schedule_paper_statuses(status)`,
    );

  if (scope === "upcoming") {
    query.or(
      `week_start.gte.${currentWeekStart},week_start.is.null`,
    );
  } else {
    query.lt("week_start", currentWeekStart);
  }

  if (filters.clubId) {
    query.eq("club_id", filters.clubId);
  }

  query
    .eq("clubs.club_members.user_id", userId)
    .eq("schedule_paper_statuses.user_id", userId);

  if (search) {
    query.or(paperSearchFilter(search), { referencedTable: "papers" });
  }

  const { data, error } = await query
    .order("week_start", {
      ascending: scope === "upcoming",
      nullsFirst: false,
    })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Dashboard schedule query returned no data.");
  }

  return (data as unknown as DashboardFeedItemRaw[]).map(
    normalizeDashboardFeedItem,
  );
}

export async function getSchedule(clubId: string, scheduleId: string) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name, avatar_id, avatar_color)",
    )
    .eq("club_id", clubId)
    .eq("id", scheduleId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeSchedule(data as unknown as ScheduleWithPaperRaw);
}

export async function getScheduleById(scheduleId: string) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), clubs(id, name, slug), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name, avatar_id, avatar_color)",
    )
    .eq("id", scheduleId)
    .single();

  if (error) {
    throw error;
  }

  return normalizeSchedule(data as unknown as ScheduleWithPaperRaw);
}

export async function getClubProgress(clubId: string) {
  const { data, error } = await supabase.rpc("get_club_schedule_progress", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Club schedule progress query returned no data.");
  }

  return data;
}

export async function lookupArxivMetadata(input: string) {
  const { data, error } = await supabase.functions.invoke<ArxivMetadata>(
    "arxiv-lookup",
    {
      body: { action: "lookup", input },
    },
  );

  if (error) {
    throw await functionInvocationError(error, "arXiv lookup failed.");
  }

  if (!data) {
    throw new Error("No arXiv metadata returned.");
  }

  return data;
}

export async function scheduleArxivPaper(values: {
  clubId: string;
  deadline: string | null;
  metadata: ArxivMetadata;
}) {
  const { data, error } = await supabase.functions.invoke<{
    schedule_id: string;
  }>("arxiv-lookup", {
    body: {
      action: "schedule",
      input: values.metadata.arxiv_id,
      clubId: values.clubId,
      deadline: values.deadline,
      notes: null,
    },
  });

  if (error) {
    throw await functionInvocationError(
      error,
      "Scheduled arXiv paper was not created.",
    );
  }

  if (!data?.schedule_id) {
    throw new Error("Scheduled arXiv paper was not created.");
  }

  return getSchedule(values.clubId, data.schedule_id);
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
  const { data, error } = await supabase.rpc("schedule_manual_paper", {
    p_club_id: values.clubId,
    p_week_start: values.deadline ?? undefined,
    p_metadata: values.metadata as unknown as Json,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Scheduled manual paper was not created.");
  }

  return getSchedule(values.clubId, data.id);
}

export async function scheduleExistingPaper(values: {
  clubId: string;
  deadline: string | null;
  paperId: string;
}) {
  const { data, error } = await supabase.rpc("schedule_existing_paper", {
    p_club_id: values.clubId,
    p_paper_id: values.paperId,
    p_week_start: values.deadline ?? undefined,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Existing paper was not scheduled.");
  }

  return getSchedule(values.clubId, data.id);
}

export async function updateScheduledPaperDeadline(values: {
  scheduleId: string;
  deadline: string | null;
}) {
  const { data, error } = await supabase.rpc("update_scheduled_paper_deadline", {
    p_schedule_id: values.scheduleId,
    p_week_start: values.deadline ?? undefined,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Scheduled paper deadline was not updated.");
  }

  return getSchedule(data.club_id, data.id);
}

export async function deleteScheduledPaper(scheduleId: string) {
  const { data, error } = await supabase.rpc("delete_scheduled_paper", {
    p_schedule_id: scheduleId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Scheduled paper was not deleted.");
  }

  return data;
}

export async function saveScheduleReadingProgress(values: {
  scheduleId: string;
  currentPage: number;
  totalPages: number;
  status: PaperStatus;
}) {
  const { data, error } = await supabase.rpc("save_schedule_reading_progress", {
    p_schedule_id: values.scheduleId,
    p_current_page: values.currentPage,
    p_total_pages: values.totalPages,
    p_status: values.status,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Schedule reading progress was not saved.");
  }

  return data;
}

type ScheduleWithPaperRaw = ScheduleRow & {
  page_count?: number | null;
  papers: PaperRow | null;
  clubs?: ScheduleWithPaper["clubs"];
  suggested_by?: ScheduleWithPaper["suggested_by"];
};

type DashboardFeedItemRaw = ScheduleWithPaperRaw & {
  schedule_paper_statuses?: Array<{
    status: PaperStatus;
  }> | null;
};

function normalizeSchedule(row: ScheduleWithPaperRaw): ScheduleWithPaper {
  if (!row.papers) {
    throw new Error(`Missing paper for schedule "${row.id}".`);
  }

  return {
    ...row,
    papers: normalizePaper(row.papers, row.page_count),
  };
}

function normalizeDashboardFeedItem(
  row: DashboardFeedItemRaw,
): DashboardFeedItem {
  const { schedule_paper_statuses: statuses, ...schedule } = row;

  return {
    ...normalizeSchedule(schedule),
    currentStatus: statuses?.at(0)?.status ?? null,
  };
}

function paperSearchFilter(search: string) {
  const pattern = quotePostgrestValue(
    `%${escapeLikePattern(search)}%`,
  );

  return `title.ilike.${pattern},abstract.ilike.${pattern}`;
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function quotePostgrestValue(value: string) {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

function normalizePaper(
  row: PaperRow,
  contextPageCount?: number | null,
): Paper {
  return {
    ...row,
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
