import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/supabase/database.types";

export type AnnotationKind =
  Database["public"]["Enums"]["paper_annotation_kind"];

export type AnnotationRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type AnnotationPosition = {
  type: "text" | "area";
  boundingRect: AnnotationRect;
  rects: AnnotationRect[];
};

export type AnnotationReplyRow =
  Database["public"]["Tables"]["paper_annotation_replies"]["Row"] & {
    profiles: AnnotationProfile | null;
  };

export type AnnotationProfile = {
  id: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
};

export type PaperAnnotationRow =
  Database["public"]["Tables"]["paper_annotations"]["Row"] & {
    profiles: AnnotationProfile | null;
    paper_annotation_replies: AnnotationReplyRow[] | null;
  };

export async function listPaperAnnotations(
  supabase: SupabaseClient<Database>,
  values: { scheduleId: string; paperId: string },
) {
  const { data, error } = await supabase
    .from("paper_annotations")
    .select(
      "*, profiles(id, display_name, avatar_id, avatar_color), paper_annotation_replies(*, profiles(id, display_name, avatar_id, avatar_color))",
    )
    .eq("schedule_id", values.scheduleId)
    .eq("paper_id", values.paperId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("created_at", {
      ascending: true,
      referencedTable: "paper_annotation_replies",
    });

  if (error) {
    throw error;
  }

  return (data as PaperAnnotationRow[]).map((annotation) => ({
    ...annotation,
    paper_annotation_replies: (
      annotation.paper_annotation_replies ?? []
    ).filter((reply) => reply.deleted_at === null),
  }));
}

export async function createPaperAnnotation(
  supabase: SupabaseClient<Database>,
  values: {
    scheduleId: string;
    paperId: string;
    authorId: string;
    kind: AnnotationKind;
    pageNumber: number;
    position: AnnotationPosition;
    quote: string | null;
    body: string | null;
    color: string;
  },
) {
  const { data, error } = await supabase
    .from("paper_annotations")
    .insert({
      schedule_id: values.scheduleId,
      paper_id: values.paperId,
      author_id: values.authorId,
      kind: values.kind,
      page_number: values.pageNumber,
      position: values.position as unknown as Json,
      quote: values.quote,
      body: values.body,
      color: values.color,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createAnnotationReply(
  supabase: SupabaseClient<Database>,
  values: { annotationId: string; authorId: string; body: string },
) {
  const { data, error } = await supabase
    .from("paper_annotation_replies")
    .insert({
      annotation_id: values.annotationId,
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

export async function updatePaperAnnotationBody(
  supabase: SupabaseClient<Database>,
  annotationId: string,
  body: string | null,
) {
  const { data, error } = await supabase
    .from("paper_annotations")
    .update({ body })
    .eq("id", annotationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function softDeletePaperAnnotation(
  supabase: SupabaseClient<Database>,
  annotationId: string,
) {
  const { data, error } = await supabase
    .from("paper_annotations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", annotationId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function getAnnotationKindColor(kind: AnnotationKind) {
  switch (kind) {
    case "question":
      return "#60a5fa";
    case "explanation":
      return "#34d399";
    case "note":
      return "#c084fc";
    case "highlight":
      return "#facc15";
  }
}
