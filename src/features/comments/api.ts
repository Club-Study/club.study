import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type CommentRow = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
  } | null;
};

export async function listComments(
  supabase: SupabaseClient<Database>,
  scheduleId: string,
) {
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(id, display_name, avatar_id, avatar_color)")
    .eq("schedule_id", scheduleId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as CommentRow[];
}

export async function createComment(
  supabase: SupabaseClient<Database>,
  values: { scheduleId: string; authorId: string; body: string },
) {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      schedule_id: values.scheduleId,
      author_id: values.authorId,
      body: values.body,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCommentBody(
  supabase: SupabaseClient<Database>,
  commentId: string,
  body: string,
) {
  const { data, error } = await supabase
    .from("comments")
    .update({ body })
    .eq("id", commentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function softDeleteComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
) {
  const { data, error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
