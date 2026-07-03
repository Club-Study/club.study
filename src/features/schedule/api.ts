import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json, Database } from "@/lib/supabase/database.types";

export type Paper = Database["public"]["Tables"]["papers"]["Row"];
export type Schedule = Database["public"]["Tables"]["club_paper_schedule"]["Row"];
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

export async function listClubSchedule(
  supabase: SupabaseClient<Database>,
  clubId: string,
) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name)",
    )
    .eq("club_id", clubId)
    .order("week_start", { ascending: false });

  if (error) {
    throw error;
  }

  return data as ScheduleWithPaper[];
}

export async function listDashboardSchedule(
  supabase: SupabaseClient<Database>,
  fromWeekStart: string,
) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), clubs(id, name, slug), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name)",
    )
    .gte("week_start", fromWeekStart)
    .order("week_start", { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return data as ScheduleWithPaper[];
}

export async function getSchedule(
  supabase: SupabaseClient<Database>,
  clubId: string,
  scheduleId: string,
) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name)",
    )
    .eq("club_id", clubId)
    .eq("id", scheduleId)
    .single();

  if (error) {
    throw error;
  }

  return data as ScheduleWithPaper;
}

export async function getScheduleById(
  supabase: SupabaseClient<Database>,
  scheduleId: string,
) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(
      "*, papers(*), clubs(id, name, slug), suggested_by:profiles!club_paper_schedule_created_by_fkey(id, display_name)",
    )
    .eq("id", scheduleId)
    .single();

  if (error) {
    throw error;
  }

  return data as ScheduleWithPaper;
}

export async function getClubProgress(
  supabase: SupabaseClient<Database>,
  clubId: string,
) {
  const { data, error } = await supabase.rpc("get_club_schedule_progress", {
    p_club_id: clubId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function lookupArxivMetadata(
  supabase: SupabaseClient<Database>,
  input: string,
) {
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

export async function scheduleArxivPaper(
  supabase: SupabaseClient<Database>,
  values: {
    clubId: string;
    weekStart: string;
    metadata: ArxivMetadata;
  },
) {
  const { data, error } = await supabase.rpc("schedule_arxiv_paper", {
    p_club_id: values.clubId,
    p_week_start: values.weekStart,
    p_arxiv_metadata: values.metadata as unknown as Json,
    p_notes: undefined,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function scheduleManualPaper(
  supabase: SupabaseClient<Database>,
  values: {
    clubId: string;
    weekStart: string;
    metadata: {
      title: string;
      authors: string[];
      abstract: string | null;
      doi: string | null;
      license: string | null;
      external_url: string;
    };
  },
) {
  const { data, error } = await supabase.rpc("schedule_manual_paper", {
    p_club_id: values.clubId,
    p_week_start: values.weekStart,
    p_metadata: values.metadata as unknown as Json,
    p_notes: undefined,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function toggleReadStatus(
  supabase: SupabaseClient<Database>,
  scheduleId: string,
  read: boolean,
) {
  const { data, error } = await supabase.rpc("toggle_read_status", {
    p_schedule_id: scheduleId,
    p_read: read,
  });

  if (error) {
    throw error;
  }

  return data;
}
