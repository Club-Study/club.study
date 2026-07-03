import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KatexText } from "@/components/katex-text";
import { LogReadingSessionDialog } from "@/components/log-reading-session-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperReader } from "@/features/annotations/PaperReader";
import { useCurrentUser } from "@/features/auth/queries";
import {
  logPersonalPaperReadingSession,
  setPersonalPaperStatus,
} from "@/features/profile/api";
import { ProfileLoading } from "@/features/profile/components/ProfileLoading";
import { profileOverviewQueryOptions } from "@/features/profile/queries";
import { updatePaperPageCount, type PaperStatus } from "@/features/schedule/api";
import { formatOptionalDateLabel } from "@/lib/dates/week";
import { queryKeys } from "@/lib/queryKeys";

export function PersonalPaperPage({
  personalPaperId,
}: {
  personalPaperId: string;
}) {
  const queryClient = useQueryClient();
  const [showPdf, setShowPdf] = useState(false);
  const user = useCurrentUser();
  const overview = useQuery({
    ...profileOverviewQueryOptions(user.data?.id ?? ""),
    enabled: Boolean(user.data?.id),
  });
  const personalPaper = overview.data?.personalPapers.find(
    (paper) => paper.id === personalPaperId,
  );
  const pagesRead = (overview.data?.readingSessions ?? [])
    .filter((session) => session.personal_paper_id === personalPaperId)
    .reduce((total, session) => total + session.pages_read, 0);
  const paper = personalPaper?.papers;
  const embeddedPdfUrl = paper ? getEmbeddedPdfUrl(paper) : null;
  const browserPaperUrl = paper ? getBrowserPaperUrl(paper) : null;
  const updateStatus = useMutation({
    mutationFn: (status: PaperStatus) => {
      if (!personalPaper) {
        throw new Error("Personal paper is still loading.");
      }

      return setPersonalPaperStatus(personalPaper.id, status);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
    },
    onError: (error) => toast.error(error.message),
  });
  const updatePageCount = useMutation({
    mutationFn: ({ paperId, pageCount }: { paperId: string; pageCount: number }) =>
      updatePaperPageCount(paperId, pageCount),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
    },
    onError: (error) => toast.error(error.message),
  });
  const logSession = useMutation({
    mutationFn: (pages: number) => {
      if (!personalPaper) {
        throw new Error("Personal paper is still loading.");
      }

      return logPersonalPaperReadingSession(personalPaper.id, pages);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.root });
    },
    onError: (error) => toast.error(error.message),
  });

  async function saveReadingProgress(values: {
    currentPage: number;
    totalPages: number;
    status: PaperStatus;
  }) {
    if (!paper || !personalPaper) {
      throw new Error("Personal paper is still loading.");
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

    const nextStatus = pagesToLog > 0 && values.status !== "read"
      ? "reading"
      : values.status;

    if (nextStatus !== personalPaper.status) {
      await updateStatus.mutateAsync(nextStatus);
    }

    toast.success("Reading progress updated");
  }

  if (user.error) {
    throw user.error;
  }

  if (overview.error) {
    throw overview.error;
  }

  if (user.isPending || overview.isPending) {
    return <ProfileLoading />;
  }

  if (!personalPaper || !paper) {
    return <p className="text-sm text-muted-foreground">Paper not found.</p>;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{paper.source_type}</Badge>
          <span className="text-sm text-muted-foreground">Personal</span>
          <span className="text-sm text-muted-foreground">
            {formatOptionalDateLabel(personalPaper.deadline)}
          </span>
          {pagesRead > 0 || paper?.page_count ? (
            <span className="text-sm text-muted-foreground">
              {formatPageProgress(pagesRead, paper?.page_count ?? null)}
            </span>
          ) : null}
        </div>
        <h2 className="text-2xl font-semibold leading-tight">{paper.title}</h2>
        <p className="text-sm text-muted-foreground">
          {formatAuthors(paper.authors)}
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
            status={personalPaper.status}
            disabled={
              logSession.isPending ||
              updatePageCount.isPending ||
              updateStatus.isPending
            }
            onSave={saveReadingProgress}
          />
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

      {showPdf && embeddedPdfUrl ? (
        <PaperReader
          pdfUrl={embeddedPdfUrl}
          browserUrl={browserPaperUrl}
          scheduleId={null}
          paperId={paper.id}
          title={paper.title}
        />
      ) : null}
    </section>
  );
}

function formatAuthors(authors: string[]) {
  if (!Array.isArray(authors)) {
    throw new Error("Paper authors must be an array.");
  }

  const names = authors.map((author) => {
    if (typeof author !== "string") {
      throw new Error("Paper authors must be strings.");
    }

    return author;
  });

  return names.join(", ");
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
