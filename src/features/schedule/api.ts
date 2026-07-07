import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/supabase/database.types";

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

export async function listDashboardSchedule(fromWeekStart: string) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), clubs(id, name, slug), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name, avatar_id, avatar_color)",
    )
    .or(`week_start.gte.${fromWeekStart},week_start.is.null`)
    .order("week_start", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Dashboard schedule query returned no data.");
  }

  return (data as unknown as ScheduleWithPaperRaw[]).map(normalizeSchedule);
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
      body: { input },
    },
  );

  if (error) {
    throw error;
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
  const { data, error } = await supabase.rpc("schedule_arxiv_paper", {
    p_club_id: values.clubId,
    p_week_start: values.deadline,
    p_arxiv_metadata: values.metadata as unknown as Json,
    p_notes: null,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Scheduled arXiv paper was not created.");
  }

  return getSchedule(values.clubId, data.id);
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
    p_week_start: values.deadline,
    p_metadata: values.metadata as unknown as Json,
    p_notes: null,
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
    p_week_start: values.deadline,
    p_notes: null,
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
    p_week_start: values.deadline,
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

export async function toggleReadStatus(scheduleId: string, read: boolean) {
  const { data, error } = await supabase.rpc("toggle_read_status", {
    p_schedule_id: scheduleId,
    p_read: read,
  });

  if (error) {
    throw error;
  }

  return oneStatusResult(data, "Schedule read status was not updated.");
}

export async function setSchedulePaperStatus(
  scheduleId: string,
  status: PaperStatus,
) {
  const { data, error } = await supabase.rpc("set_schedule_paper_status", {
    p_schedule_id: scheduleId,
    p_status: status,
  });

  if (error) {
    throw error;
  }

  return oneStatusResult(data, "Schedule paper status was not updated.");
}

export async function updatePaperPageCount(paperId: string, pageCount: number) {
  const { data, error } = await supabase.rpc("update_paper_page_count", {
    p_paper_id: paperId,
    p_page_count: pageCount,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Paper page count was not updated.");
  }

  return normalizePaper(data);
}

export async function logScheduleReadingSession(
  scheduleId: string,
  pagesRead: number,
) {
  const { data, error } = await supabase.rpc("log_schedule_reading_session", {
    p_schedule_id: scheduleId,
    p_pages_read: pagesRead,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Schedule reading session was not logged.");
  }

  return data;
}

type ScheduleWithPaperRaw = ScheduleRow & {
  papers: PaperRow | null;
  clubs?: ScheduleWithPaper["clubs"];
  suggested_by?: ScheduleWithPaper["suggested_by"];
};

type ScheduleStatusResult =
  Database["public"]["Functions"]["set_schedule_paper_status"]["Returns"][number];

function normalizeSchedule(row: ScheduleWithPaperRaw): ScheduleWithPaper {
  if (!row.papers) {
    throw new Error(`Missing paper for schedule "${row.id}".`);
  }

  return {
    ...row,
    papers: normalizePaper(row.papers),
  };
}

function normalizePaper(row: PaperRow): Paper {
  return {
    ...row,
    authors: stringArray(row.authors, `paper "${row.id}" authors`),
  };
}

function oneStatusResult(
  data: ScheduleStatusResult[] | null,
  emptyMessage: string,
) {
  const row = data?.at(0);

  if (!row) {
    throw new Error(emptyMessage);
  }

  return row;
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
