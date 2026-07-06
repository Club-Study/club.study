import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type CommentRow = Database["public"]["Tables"]["comments"]["Row"] & {
  profiles: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
  } | null;
};

const commentSelect =
  "*, profiles(id, display_name, avatar_id, avatar_color)" as const;

export async function listComments(scheduleId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select(commentSelect)
    .eq("schedule_id", scheduleId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Comments query returned no data.");
  }

  return data as unknown as CommentRow[];
}

export async function createComment(values: { scheduleId: string; body: string }) {
  const authorId = await requireCurrentUserId();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      schedule_id: values.scheduleId,
      author_id: authorId,
      body: values.body,
    })
    .select(commentSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as CommentRow;
}

export async function updateCommentBody(commentId: string, body: string) {
  const { data, error } = await supabase
    .from("comments")
    .update({ body })
    .eq("id", commentId)
    .select(commentSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as CommentRow;
}

export async function softDeleteComment(commentId: string) {
  const { data, error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .select(commentSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as CommentRow;
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
