import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { scheduleProgressQueryOptions } from "@/features/schedule/queries";
import {
  getSchedule,
  getScheduleById,
  toggleReadStatus,
  type ScheduleWithPaper,
} from "@/features/schedule/api";
import { PaperReader } from "@/features/annotations/PaperReader";
import { CommentsPanel } from "@/features/comments/CommentsPanel";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatWeekLabel } from "@/lib/dates/week";

export function ScheduledPaperPage({
  clubId,
  scheduleId,
}: {
  clubId?: string;
  scheduleId: string;
}) {
  const queryClient = useQueryClient();
  const [showPdf, setShowPdf] = useState(false);
  const schedule = useQuery<ScheduleWithPaper>({
    queryKey: clubId
      ? queryKeys.schedule.detail(clubId, scheduleId)
      : queryKeys.schedule.detailById(scheduleId),
    queryFn: () =>
      clubId
        ? getSchedule(clubId, scheduleId)
        : getScheduleById(scheduleId),
  });
  const effectiveClubId = clubId ?? schedule.data?.club_id ?? "";
  const progress = useQuery({
    ...scheduleProgressQueryOptions(effectiveClubId),
    enabled: Boolean(effectiveClubId),
  });
  const rowProgress = progress.data?.find((row) => row.schedule_id === scheduleId);
  const hasReadStatus = rowProgress !== undefined;
  const toggleRead = useMutation({
    mutationFn: () => {
      if (!hasReadStatus) {
        throw new Error("Read status is still loading.");
      }

      return toggleReadStatus(scheduleId, !rowProgress.current_user_read);
    },
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.dashboardRoot,
        }),
      ];

      if (effectiveClubId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.schedule.progress(effectiveClubId),
          }),
        );
      }

      await Promise.all(invalidations);
    },
    onError: (error) => toast.error(error.message),
  });
  const paper = schedule.data?.papers;
  const embeddedPdfUrl = paper ? getEmbeddedPdfUrl(paper) : null;
  const browserPaperUrl = paper ? getBrowserPaperUrl(paper) : null;
  const readProgressLabel = `${rowProgress?.read_count ?? 0}/${
    rowProgress?.total_members ?? 0
  } read`;

  if (schedule.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading paper...</p>;
  }

  if (!schedule.data || !paper) {
    return <p className="text-sm text-muted-foreground">Paper not found.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{paper.source_type}</Badge>
          <span className="text-sm text-muted-foreground">
            {formatWeekLabel(schedule.data.week_start)}
          </span>
        </div>
        <h2 className="text-2xl font-semibold leading-tight">{paper.title}</h2>
        <p className="text-sm text-muted-foreground">
          {formatAuthors(paper.authors)}
        </p>
        <p className="text-sm text-muted-foreground">
          Suggested by {schedule.data.suggested_by?.display_name ?? "Unknown"}
        </p>
        <div className="flex flex-wrap gap-2">
          {paper.source_type === "arxiv" && paper.abstract_url ? (
            <Button asChild size="sm" variant="outline">
              <a href={paper.abstract_url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-4" />
                Open on arXiv
              </a>
            </Button>
          ) : null}
          {browserPaperUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={browserPaperUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-4" />
                Open in browser
              </a>
            </Button>
          ) : null}
          {embeddedPdfUrl ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPdf((current) => !current)}
            >
              {showPdf ? "Hide PDF" : "View PDF here"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={toggleRead.isPending || progress.isLoading || !hasReadStatus}
            onClick={() => toggleRead.mutate()}
          >
            {hasReadStatus
              ? rowProgress.current_user_read
                ? "Mark unread"
                : "Mark read"
              : "Loading status"}
          </Button>
          <span className="self-center text-sm text-muted-foreground">
            {readProgressLabel}
          </span>
        </div>
      </div>

      {paper.abstract && !showPdf ? (
        <div>
          <h3 className="text-sm font-medium">Abstract</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {paper.abstract}
          </p>
        </div>
      ) : null}

      {showPdf ? (
        embeddedPdfUrl ? (
          <PaperReader
            pdfUrl={embeddedPdfUrl}
            browserUrl={browserPaperUrl}
            scheduleId={scheduleId}
            paperId={paper.id}
            title={paper.title}
          />
        ) : (
          <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
            No embeddable PDF is available for this paper.
          </p>
        )
      ) : null}

      <Separator />
      <CommentsPanel scheduleId={scheduleId} clubId={effectiveClubId} />
    </section>
  );
}

function formatAuthors(authors: unknown) {
  return Array.isArray(authors) && authors.length > 0
    ? authors.join(", ")
    : "No authors listed";
}

function getEmbeddedPdfUrl(paper: {
  pdf_url: string | null;
  external_url: string | null;
}) {
  if (paper.pdf_url) {
    return paper.pdf_url;
  }

  if (paper.external_url && isProbablyPdfUrl(paper.external_url)) {
    return paper.external_url;
  }

  return null;
}

function isProbablyPdfUrl(url: string) {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith(".pdf") || lowerUrl.includes(".pdf?");
}

function getBrowserPaperUrl(paper: {
  pdf_url: string | null;
  external_url: string | null;
  abstract_url: string | null;
}) {
  return paper.pdf_url ?? paper.external_url ?? paper.abstract_url;
}
