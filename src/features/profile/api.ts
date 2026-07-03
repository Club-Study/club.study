import type { SupabaseClient, User } from "@supabase/supabase-js";

import { profileValuesFromUser } from "@/features/auth/api";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileMembership =
  Pick<
    Database["public"]["Tables"]["club_members"]["Row"],
    "club_id" | "created_at" | "role"
  > & {
    clubs: Pick<
      Database["public"]["Tables"]["clubs"]["Row"],
      "id" | "name" | "slug" | "description"
    >;
  };
export type ProfileScheduledPaper =
  Pick<
    Database["public"]["Tables"]["club_paper_schedule"]["Row"],
    "id" | "club_id" | "paper_id" | "week_start"
  > & {
    clubs: Pick<Database["public"]["Tables"]["clubs"]["Row"], "id" | "name" | "slug">;
    papers: Pick<
      Database["public"]["Tables"]["papers"]["Row"],
      | "id"
      | "arxiv_id"
      | "authors"
      | "external_url"
      | "pdf_url"
      | "published_at"
      | "source_type"
      | "title"
    >;
  };
export type ProfileReadingLog =
  Pick<
    Database["public"]["Tables"]["reading_logs"]["Row"],
    "id" | "read_at" | "schedule_id"
  > & {
    club_paper_schedule: ProfileScheduledPaper;
  };
export type ProfileOverview = {
  memberships: ProfileMembership[];
  readingLogs: ProfileReadingLog[];
  scheduledPapers: ProfileScheduledPaper[];
};

export async function upsertProfileFromUser(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const values = profileValuesFromUser(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(values, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfileFromUser(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const values = profileValuesFromUser(user);
  const { data, error } = await supabase
    .from("profiles")
    .upsert(values, { onConflict: "id", ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? getProfile(supabase, user.id);
}

export async function getProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
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

export async function updateProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  values: Pick<Profile, "display_name" | "avatar_id" | "avatar_color" | "bio">,
) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...values }, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProfileOverview(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProfileOverview> {
  const [memberships, readingLogs, scheduledPapers] = await Promise.all([
    listProfileMemberships(supabase, userId),
    listProfileReadingLogs(supabase, userId),
    listVisibleScheduledPapers(supabase),
  ]);

  return {
    memberships,
    readingLogs,
    scheduledPapers,
  };
}

async function listProfileMemberships(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
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

  const memberships = data as ProfileMembership[];

  for (const membership of memberships) {
    if (!membership.clubs) {
      throw new Error(`Missing club for membership "${membership.club_id}".`);
    }
  }

  return memberships;
}

async function listProfileReadingLogs(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
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
        week_start,
        clubs(id, name, slug),
        papers(id, arxiv_id, authors, external_url, pdf_url, published_at, source_type, title)
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

  const logs = data as unknown as ProfileReadingLog[];

  for (const log of logs) {
    assertScheduledPaper(log.club_paper_schedule, log.schedule_id);
  }

  return logs;
}

async function listVisibleScheduledPapers(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("club_paper_schedule")
    .select(`
      id,
      club_id,
      paper_id,
      week_start,
      clubs(id, name, slug),
      papers(id, arxiv_id, authors, external_url, pdf_url, published_at, source_type, title)
    `)
    .order("week_start", { ascending: false });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Profile scheduled papers query returned no data.");
  }

  const scheduledPapers = data as unknown as ProfileScheduledPaper[];

  for (const scheduledPaper of scheduledPapers) {
    assertScheduledPaper(scheduledPaper, scheduledPaper.id);
  }

  return scheduledPapers;
}

function assertScheduledPaper(
  scheduledPaper: ProfileScheduledPaper | null,
  id: string,
): asserts scheduledPaper is ProfileScheduledPaper {
  if (!scheduledPaper) {
    throw new Error(`Missing schedule "${id}".`);
  }

  if (!scheduledPaper.clubs) {
    throw new Error(`Missing club for schedule "${id}".`);
  }

  if (!scheduledPaper.papers) {
    throw new Error(`Missing paper for schedule "${id}".`);
  }
}
