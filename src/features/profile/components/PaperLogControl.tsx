import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { LogReadingSessionDialog } from "@/components/log-reading-session-dialog";
import {
  logPersonalPaperReadingSession,
  setPersonalPaperStatus,
} from "@/features/profile/api";
import {
  logScheduleReadingSession,
  setSchedulePaperStatus,
  updatePaperPageCount,
  type PaperStatus,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";

export type PaperLogTarget =
  | {
      kind: "schedule";
      scheduleId: string;
      clubId: string;
    }
  | {
      kind: "personal";
      personalPaperId: string;
    };

export function PaperLogControl({
  paperId,
  pageCount,
  pagesRead,
  status,
  target,
}: {
  paperId: string;
  pageCount: number | null;
  pagesRead: number;
  status: PaperStatus;
  target: PaperLogTarget;
}) {
  const queryClient = useQueryClient();
  const updatePageCount = useMutation<unknown, Error, number>({
    mutationFn: (totalPages: number) =>
      updatePaperPageCount(paperId, totalPages),
  });
  const logSession = useMutation<unknown, Error, number>({
    mutationFn: (pages: number) => {
      if (target.kind === "personal") {
        return logPersonalPaperReadingSession(target.personalPaperId, pages);
      }

      return logScheduleReadingSession(target.scheduleId, pages);
    },
  });
  const updateStatus = useMutation<unknown, Error, PaperStatus>({
    mutationFn: (nextStatus: PaperStatus) => {
      if (target.kind === "personal") {
        return setPersonalPaperStatus(target.personalPaperId, nextStatus);
      }

      return setSchedulePaperStatus(target.scheduleId, nextStatus);
    },
  });

  async function saveReadingProgress(values: {
    currentPage: number;
    totalPages: number;
    status: PaperStatus;
  }) {
    if (pageCount !== values.totalPages) {
      await updatePageCount.mutateAsync(values.totalPages);
    }

    const pagesToLog = values.currentPage - pagesRead;

    if (pagesToLog < 0) {
      throw new Error("Current page cannot be less than your logged page count.");
    }

    if (pagesToLog > 0) {
      await logSession.mutateAsync(pagesToLog);
    }

    const nextStatus =
      values.currentPage === values.totalPages
        ? "read"
        : pagesToLog > 0 && values.status !== "read"
          ? "reading"
          : values.status;

    if (nextStatus !== status) {
      await updateStatus.mutateAsync(nextStatus);
    }

    await invalidatePaperQueries(queryClient, target);
    toast.success("Reading progress updated");
  }

  return (
    <LogReadingSessionDialog
      currentPagesRead={pagesRead}
      totalPages={pageCount}
      status={status}
      triggerLabel="Log"
      triggerSize="xs"
      triggerClassName="self-start text-muted-foreground"
      disabled={
        updatePageCount.isPending || logSession.isPending || updateStatus.isPending
      }
      onSave={saveReadingProgress}
    />
  );
}

export function PaperProgress({
  pagesRead,
  totalPages,
}: {
  pagesRead: number;
  totalPages: number | null;
}) {
  if (totalPages === null) {
    if (pagesRead === 0) {
      return null;
    }

    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {pagesRead} pages logged
      </p>
    );
  }

  if (totalPages < 1) {
    throw new Error(`Invalid total page count "${totalPages}".`);
  }

  if (pagesRead > totalPages) {
    throw new Error(
      `Logged page count "${pagesRead}" exceeds total page count "${totalPages}".`,
    );
  }

  const percentage = Math.round((pagesRead / totalPages) * 100);

  return (
    <div className="mt-2 max-w-md">
      <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>
          {pagesRead} of {totalPages} pages
        </span>
        <span>{percentage}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={totalPages}
        aria-valuenow={pagesRead}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

async function invalidatePaperQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  target: PaperLogTarget,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.root }),
  ];

  if (target.kind === "schedule") {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.dashboardRoot,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.list(target.clubId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.progress(target.clubId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.detail(target.clubId, target.scheduleId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.detailById(target.scheduleId),
      }),
    );
  }

  await Promise.all(invalidations);
}
