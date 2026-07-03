import { apiRequest } from "@/lib/api/client";

export type AnnotationKind = "highlight" | "question" | "explanation" | "note";

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

export type AnnotationProfile = {
  id: string;
  display_name: string;
  avatar_id: string;
  avatar_color: string;
};

export type AnnotationReplyRow = {
  id: string;
  annotation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles: AnnotationProfile | null;
};

export type PaperAnnotationRow = {
  id: string;
  schedule_id: string;
  paper_id: string;
  author_id: string;
  kind: AnnotationKind;
  page_number: number;
  position: unknown;
  quote: string | null;
  body: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  profiles: AnnotationProfile | null;
  paper_annotation_replies: AnnotationReplyRow[] | null;
};

export async function listPaperAnnotations(values: {
  scheduleId: string;
  paperId: string;
}) {
  const data = await apiRequest<PaperAnnotationRow[]>(
    `api/schedule/${values.scheduleId}/annotations/`,
    {
      query: { paper_id: values.paperId },
    },
  );

  return data.map((annotation) => ({
    ...annotation,
    paper_annotation_replies: (
      annotation.paper_annotation_replies ?? []
    ).filter((reply) => reply.deleted_at === null),
  }));
}

export async function createPaperAnnotation(values: {
  scheduleId: string;
  paperId: string;
  kind: AnnotationKind;
  pageNumber: number;
  position: AnnotationPosition;
  quote: string | null;
  body: string | null;
  color: string;
}) {
  return apiRequest<PaperAnnotationRow>(
    `api/schedule/${values.scheduleId}/annotations/`,
    {
      method: "POST",
      body: {
        paper_id: values.paperId,
        kind: values.kind,
        page_number: values.pageNumber,
        position: values.position,
        quote: values.quote,
        body: values.body,
        color: values.color,
      },
    },
  );
}

export async function createAnnotationReply(values: {
  annotationId: string;
  body: string;
}) {
  return apiRequest<AnnotationReplyRow>(
    `api/annotations/${values.annotationId}/replies/`,
    {
      method: "POST",
      body: { body: values.body },
    },
  );
}

export async function updatePaperAnnotationBody(
  annotationId: string,
  body: string | null,
) {
  return apiRequest<PaperAnnotationRow>(`api/annotations/${annotationId}/`, {
    method: "PATCH",
    body: { body },
  });
}

export async function softDeletePaperAnnotation(annotationId: string) {
  return apiRequest<PaperAnnotationRow>(`api/annotations/${annotationId}/`, {
    method: "DELETE",
  });
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
