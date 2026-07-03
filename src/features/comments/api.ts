import { apiRequest } from "@/lib/api/client";

export type CommentRow = {
  id: string;
  schedule_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles: {
    id: string;
    display_name: string;
    avatar_id: string;
    avatar_color: string;
  } | null;
};

export async function listComments(scheduleId: string) {
  return apiRequest<CommentRow[]>(`api/schedule/${scheduleId}/comments/`);
}

export async function createComment(values: { scheduleId: string; body: string }) {
  return apiRequest<CommentRow>(`api/schedule/${values.scheduleId}/comments/`, {
    method: "POST",
    body: { body: values.body },
  });
}

export async function updateCommentBody(commentId: string, body: string) {
  return apiRequest<CommentRow>(`api/comments/${commentId}/`, {
    method: "PATCH",
    body: { body },
  });
}

export async function softDeleteComment(commentId: string) {
  return apiRequest<CommentRow>(`api/comments/${commentId}/`, {
    method: "DELETE",
  });
}
