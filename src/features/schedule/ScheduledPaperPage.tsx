import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LogReadingSessionDialog } from "@/components/log-reading-session-dialog";
import { useCurrentUser } from "@/features/auth/queries";
import { isClubManagerRole } from "@/features/clubs/api";
import { membersQueryOptions } from "@/features/clubs/queries";
import { ProfileLink } from "@/features/profile/components/ProfileLink";
import { SchedulePaperActions } from "@/features/schedule/components/SchedulePaperActions";
import { scheduleProgressQueryOptions } from "@/features/schedule/queries";
import {
  getSchedule,
  getScheduleById,
  logScheduleReadingSession,
  setSchedulePaperStatus,
  updatePaperPageCount,
  type PaperStatus,
  type ScheduleWithPaper,
} from "@/features/schedule/api";
import { PaperReader } from "@/features/annotations/PaperReader";
import { CommentsPanel } from "@/features/comments/CommentsPanel";
import { queryKeys } from "@/lib/queryKeys";
import { KatexText } from "@/components/katex-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatOptionalDateLabel } from "@/lib/dates/week";

export function ScheduledPaperPage({
  clubId,
  scheduleId,
}: {
  clubId?: string;
  scheduleId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
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
  const members = useQuery({
    ...membersQueryOptions(effectiveClubId),
    enabled: Boolean(effectiveClubId),
  });
  const currentMembership = members.data?.find(
    (member) => member.user_id === currentUser.data?.id,
  );
  const isManager = isClubManagerRole(currentMembership?.role);
  const rowProgress = progress.data?.find((row) => row.schedule_id === scheduleId);
  const hasReadStatus = rowProgress !== undefined;
  const updateStatus = useMutation({
    mutationFn: (status: PaperStatus) => setSchedulePaperStatus(scheduleId, status),
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.dashboardRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.root,
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
  const updatePageCount = useMutation({
    mutationFn: ({ paperId, pageCount }: { paperId: string; pageCount: number }) =>
      updatePaperPageCount(paperId, pageCount),
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: clubId
            ? queryKeys.schedule.detail(clubId, scheduleId)
            : queryKeys.schedule.detailById(scheduleId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.dashboardRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.root,
        }),
      ];

      if (effectiveClubId) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.schedule.list(effectiveClubId),
          }),
        );
      }

      await Promise.all(invalidations);
    },
    onError: (error) => toast.error(error.message),
  });
  const logSession = useMutation({
    mutationFn: (pages: number) => logScheduleReadingSession(scheduleId, pages),
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.schedule.dashboardRoot,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.root,
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
  const pagesRead = rowProgress?.current_user_pages_read ?? 0;
  const pageProgressLabel = paper
    ? formatPageProgress(pagesRead, paper.page_count)
    : "";

  async function saveReadingProgress(values: {
    currentPage: number;
    totalPages: number;
    status: PaperStatus;
  }) {
    if (!paper) {
      throw new Error("Paper is still loading.");
    }

    if (!hasReadStatus) {
      throw new Error("Read status is still loading.");
    }

    if (paper.page_count !== values.totalPages) {
      await updatePageCount.mutateAsync({
        paperId: paper.id,
        pageCount: values.totalPages,
      });
    }

    const pagesToLog = values.currentPage - pagesRead;
    if (pagesToLog > 0) {
      await logSession.mutateAsync(pagesToLog);
    }

    const nextStatus =
      values.currentPage === values.totalPages
        ? "read"
        : pagesToLog > 0 && values.status !== "read"
          ? "reading"
          : values.status;

    if (nextStatus !== rowProgress.current_user_status) {
      await updateStatus.mutateAsync(nextStatus);
    }

    toast.success("Reading progress updated");
  }

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
            {formatOptionalDateLabel(schedule.data.week_start)}
          </span>
          {isManager ? (
            <SchedulePaperActions
              schedule={schedule.data}
              onDeleted={(deletedClubId) => {
                void navigate({
                  to: "/app/clubs/$clubId/schedule",
                  params: { clubId: deletedClubId },
                });
              }}
            />
          ) : null}
        </div>
        <h2 className="text-2xl font-semibold leading-tight">{paper.title}</h2>
        <p className="text-sm text-muted-foreground">
          {formatAuthors(paper.authors)}
        </p>
        <p className="text-sm text-muted-foreground">
          Suggested by{" "}
          <ProfileLink
            userId={schedule.data.suggested_by?.id}
            className="hover:underline"
          >
            {schedule.data.suggested_by?.display_name ?? "Unknown"}
          </ProfileLink>
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
          <LogReadingSessionDialog
            currentPagesRead={pagesRead}
            totalPages={paper.page_count}
            status={rowProgress?.current_user_status ?? "planned"}
            disabled={
              logSession.isPending ||
              updatePageCount.isPending ||
              updateStatus.isPending ||
              progress.isLoading ||
              !hasReadStatus
            }
            onSave={saveReadingProgress}
          />
          <span className="self-center text-sm text-muted-foreground">
            {readProgressLabel}
            {pageProgressLabel ? ` · ${pageProgressLabel}` : ""}
          </span>
        </div>
      </div>

      {paper.abstract && !showPdf ? (
        <div>
          <h3 className="text-sm font-medium">Abstract</h3>
          <KatexText
            text={paper.abstract}
            className="mt-2 text-sm leading-6 text-muted-foreground"
          />
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

function formatPageProgress(pagesRead: number, totalPages: number | null) {
  if (pagesRead === 0 && totalPages === null) {
    return "";
  }

  if (totalPages === null) {
    return `${pagesRead} pages`;
  }

  return `${pagesRead} of ${totalPages} pages`;
}

function getBrowserPaperUrl(paper: {
  pdf_url: string | null;
  external_url: string | null;
  abstract_url: string | null;
}) {
  return paper.pdf_url ?? paper.external_url ?? paper.abstract_url;
}
