import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLinkIcon,
  MessageSquareIcon,
  MinusIcon,
  PanelRightIcon,
  PlusIcon,
  SquareDashedMousePointerIcon,
  XIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { toast } from "sonner";

import { PixelAvatar } from "@/components/pixel-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createAnnotationReply,
  createPaperAnnotation,
  getAnnotationKindColor,
  listPaperAnnotations,
  type AnnotationKind,
  type AnnotationPosition,
  type AnnotationRect,
  type PaperAnnotationRow,
} from "@/features/annotations/api";
import {
  getBoundingRect,
  isAnnotationPosition,
  normalizeClientRect,
} from "@/features/annotations/position";
import { useCurrentUser } from "@/features/auth/queries";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type PendingAnnotation = {
  pageNumber: number;
  position: AnnotationPosition;
  quote: string | null;
  clientX: number;
  clientY: number;
};

type AreaDraft = {
  pageNumber: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

const zoomLevels = [0.8, 1, 1.15, 1.3] as const;
const defaultKind: AnnotationKind = "highlight";

export function PaperReader({
  pdfUrl,
  browserUrl,
  scheduleId,
  paperId,
  title,
}: {
  pdfUrl: string;
  browserUrl: string | null;
  scheduleId: string | null;
  paperId: string;
  title: string;
}) {
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const hasAnnotationContext = scheduleId !== null;
  const [discussionVisible, setDiscussionVisible] = useState(false);
  const [areaMode, setAreaMode] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [paneWidth, setPaneWidth] = useState(860);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null,
  );
  const [pending, setPending] = useState<PendingAnnotation | null>(null);
  const [pendingKind, setPendingKind] = useState<AnnotationKind>(defaultKind);
  const [pendingBody, setPendingBody] = useState("");
  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const paneRef = useRef<HTMLDivElement | null>(null);
  const zoom = zoomLevels[zoomIndex] ?? 1;
  const pageWidth = Math.max(320, Math.min(920, paneWidth - 24)) * zoom;
  const annotations = useQuery({
    queryKey: hasAnnotationContext
      ? queryKeys.annotations.list(scheduleId, paperId)
      : ["annotations", "unavailable", paperId],
    queryFn: () => {
      if (scheduleId === null) {
        throw new Error("Paper annotations require a schedule.");
      }

      return listPaperAnnotations({ scheduleId, paperId });
    },
    enabled: discussionVisible && hasAnnotationContext,
  });
  const visibleAnnotations =
    discussionVisible && hasAnnotationContext ? annotations.data ?? [] : [];
  const selectedAnnotation =
    visibleAnnotations.find((annotation) => annotation.id === selectedAnnotationId) ??
    visibleAnnotations[0] ??
    null;
  const createAnnotation = useMutation({
    mutationFn: () => {
      if (!user.data) {
        throw new Error("Sign in required.");
      }

      if (!pending) {
        throw new Error("Select text or an area first.");
      }

      if (scheduleId === null) {
        throw new Error("Paper annotations require a schedule.");
      }

      return createPaperAnnotation({
        scheduleId,
        paperId,
        kind: pendingKind,
        pageNumber: pending.pageNumber,
        position: pending.position,
        quote: pending.quote,
        body: pendingBody.trim() || null,
        color: getAnnotationKindColor(pendingKind),
      });
    },
    onSuccess: async (created) => {
      if (scheduleId === null) {
        throw new Error("Paper annotations require a schedule.");
      }

      setPending(null);
      setPendingBody("");
      setPendingKind(defaultKind);
      setSelectedAnnotationId(created.id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.annotations.list(scheduleId, paperId),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!paneRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setPaneWidth(entry.contentRect.width);
    });
    resizeObserver.observe(paneRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const pages = useMemo(
    () => Array.from({ length: numPages }, (_, index) => index + 1),
    [numPages],
  );

  function closePending() {
    setPending(null);
    setPendingBody("");
    setPendingKind(defaultKind);
  }

  function toggleDiscussion() {
    setDiscussionVisible((current) => {
      const next = !current;

      if (!next) {
        setAreaMode(false);
        setPending(null);
        setSelectedAnnotationId(null);
      }

      return next;
    });
  }

  function handleTextSelection(pageNumber: number) {
    if (!discussionVisible || !hasAnnotationContext || areaMode) {
      return;
    }

    window.setTimeout(() => {
      const selection = window.getSelection();
      const quote = selection?.toString().trim();
      const pageElement = pageRefs.current.get(pageNumber);

      if (!selection || !quote || selection.rangeCount === 0 || !pageElement) {
        return;
      }

      const range = selection.getRangeAt(0);
      const pageRect = pageElement.getBoundingClientRect();
      const rects = Array.from(range.getClientRects())
        .map((rect) => normalizeClientRect(rect, pageRect))
        .filter((rect): rect is AnnotationRect => rect !== null);

      if (rects.length === 0) {
        return;
      }

      const lastRect = range.getBoundingClientRect();
      setPending({
        pageNumber,
        quote,
        position: {
          type: "text",
          boundingRect: getBoundingRect(rects),
          rects,
        },
        clientX: Math.min(lastRect.left, window.innerWidth - 340),
        clientY: Math.min(lastRect.bottom + 8, window.innerHeight - 260),
      });
      setPendingKind(defaultKind);
      selection.removeAllRanges();
    }, 0);
  }

  function handleAreaPointerDown(
    pageNumber: number,
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (
      !discussionVisible ||
      !hasAnnotationContext ||
      !areaMode ||
      event.button !== 0
    ) {
      return;
    }

    const pageElement = pageRefs.current.get(pageNumber);
    if (!pageElement) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageRect = pageElement.getBoundingClientRect();
    const startX = ((event.clientX - pageRect.left) / pageRect.width) * 100;
    const startY = ((event.clientY - pageRect.top) / pageRect.height) * 100;
    window.getSelection()?.removeAllRanges();
    setAreaDraft({
      pageNumber,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  }

  function handleAreaPointerMove(
    pageNumber: number,
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (!areaDraft || areaDraft.pageNumber !== pageNumber) {
      return;
    }

    const pageElement = pageRefs.current.get(pageNumber);
    if (!pageElement) {
      return;
    }

    const pageRect = pageElement.getBoundingClientRect();
    setAreaDraft((current) =>
      current
        ? {
            ...current,
            currentX: clampPercent(
              ((event.clientX - pageRect.left) / pageRect.width) * 100,
            ),
            currentY: clampPercent(
              ((event.clientY - pageRect.top) / pageRect.height) * 100,
            ),
          }
        : null,
    );
  }

  function handleAreaPointerUp(
    pageNumber: number,
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (!areaDraft || areaDraft.pageNumber !== pageNumber) {
      return;
    }

    const rect = getDraftRect(areaDraft);
    setAreaDraft(null);

    if (rect.width < 1 || rect.height < 1) {
      return;
    }

    setPending({
      pageNumber,
      quote: null,
      position: {
        type: "area",
        boundingRect: rect,
        rects: [rect],
      },
      clientX: Math.min(event.clientX, window.innerWidth - 340),
      clientY: Math.min(event.clientY + 8, window.innerHeight - 260),
    });
    setPendingKind("note");
    setAreaMode(false);
  }

  function selectAnnotation(annotationId: string) {
    setSelectedAnnotationId(annotationId);

    const annotation = visibleAnnotations.find((item) => item.id === annotationId);
    if (!annotation || !isAnnotationPosition(annotation.position)) {
      return;
    }

    window.requestAnimationFrame(() => scrollAnnotationIntoView(annotation));
  }

  function scrollAnnotationIntoView(annotation: PaperAnnotationRow) {
    const paneElement = paneRef.current;
    const pageElement = pageRefs.current.get(annotation.page_number);

    if (!paneElement || !pageElement || !isAnnotationPosition(annotation.position)) {
      return;
    }

    const paneRect = paneElement.getBoundingClientRect();
    const pageRect = pageElement.getBoundingClientRect();
    const target = annotation.position.boundingRect;
    const targetCenterX =
      pageRect.left -
      paneRect.left +
      ((target.left + target.width / 2) / 100) * pageRect.width;
    const targetTop =
      paneElement.scrollTop +
      pageRect.top -
      paneRect.top +
      (target.top / 100) * pageRect.height -
      96;
    const targetLeft =
      paneElement.scrollLeft + targetCenterX - paneElement.clientWidth / 2;

    paneElement.scrollTo({
      top: Math.max(0, targetTop),
      left: Math.max(0, targetLeft),
      behavior: "smooth",
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {hasAnnotationContext ? (
            <Button
              type="button"
              size="sm"
              variant={discussionVisible ? "default" : "outline"}
              onClick={toggleDiscussion}
            >
              <PanelRightIcon className="size-4" />
              {discussionVisible ? "Hide discussion" : "Show discussion"}
            </Button>
          ) : null}
          {discussionVisible ? (
            <Button
              type="button"
              size="sm"
              variant={areaMode ? "default" : "outline"}
              onClick={() => setAreaMode((current) => !current)}
            >
              <SquareDashedMousePointerIcon className="size-4" />
              Area
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((current) => Math.max(0, current - 1))}
          >
            <MinusIcon className="size-4" />
            <span className="sr-only">Zoom out</span>
          </Button>
          <span className="min-w-10 text-center text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={zoomIndex === zoomLevels.length - 1}
            onClick={() =>
              setZoomIndex((current) =>
                Math.min(zoomLevels.length - 1, current + 1),
              )
            }
          >
            <PlusIcon className="size-4" />
            <span className="sr-only">Zoom in</span>
          </Button>
        </div>
        {browserUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={browserUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon className="size-4" />
              Open in browser
            </a>
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "grid h-[calc(100vh-12rem)] min-h-[32rem] overflow-hidden",
          discussionVisible
            ? "grid-rows-[minmax(0,1fr)_18rem] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:grid-rows-1"
            : "grid-rows-1",
        )}
      >
        <div
          ref={paneRef}
          className="min-h-0 min-w-0 overflow-auto rounded-md border bg-muted/20 p-3"
        >
          <Document
            file={pdfUrl}
            aria-label={title}
            loading={<PdfMessage>Loading PDF...</PdfMessage>}
            error={<PdfFallback browserUrl={browserUrl} />}
            onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}
            onLoadError={() => setNumPages(0)}
            externalLinkTarget="_blank"
          >
            <div className="space-y-4">
              {pages.map((pageNumber) => (
                <div
                  key={pageNumber}
                  ref={(element) => {
                    if (element) {
                      pageRefs.current.set(pageNumber, element);
                    } else {
                      pageRefs.current.delete(pageNumber);
                    }
                  }}
                  className="relative mx-auto w-fit overflow-hidden rounded-sm bg-background shadow-sm"
                  onMouseUp={() => handleTextSelection(pageNumber)}
                  onPointerDownCapture={(event) =>
                    handleAreaPointerDown(pageNumber, event)
                  }
                  onPointerMoveCapture={(event) =>
                    handleAreaPointerMove(pageNumber, event)
                  }
                  onPointerUpCapture={(event) =>
                    handleAreaPointerUp(pageNumber, event)
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    width={pageWidth}
                    renderTextLayer
                    renderAnnotationLayer
                    loading={<PdfMessage>Loading page...</PdfMessage>}
                  />
                  {discussionVisible && hasAnnotationContext ? (
                    <HighlightLayer
                      annotations={visibleAnnotations}
                      pageNumber={pageNumber}
                      selectedAnnotationId={selectedAnnotationId}
                      onSelect={selectAnnotation}
                    />
                  ) : null}
                  {areaDraft?.pageNumber === pageNumber ? (
                    <AreaDraftBox rect={getDraftRect(areaDraft)} />
                  ) : null}
                </div>
              ))}
            </div>
          </Document>
        </div>

        {discussionVisible && hasAnnotationContext ? (
          <AnnotationRail
            annotations={visibleAnnotations}
            selectedAnnotation={selectedAnnotation}
            scheduleId={scheduleId}
            paperId={paperId}
            currentUserId={user.data?.id ?? null}
            onSelect={selectAnnotation}
            loading={annotations.isLoading}
          />
        ) : null}
      </div>

      {pending && hasAnnotationContext ? (
        <AnnotationComposer
          pending={pending}
          kind={pendingKind}
          body={pendingBody}
          saving={createAnnotation.isPending}
          onKindChange={(kind) => {
            setPendingKind(kind);
          }}
          onBodyChange={setPendingBody}
          onClose={closePending}
          onSave={() => createAnnotation.mutate()}
        />
      ) : null}
    </section>
  );
}

function HighlightLayer({
  annotations,
  pageNumber,
  selectedAnnotationId,
  onSelect,
}: {
  annotations: PaperAnnotationRow[];
  pageNumber: number;
  selectedAnnotationId: string | null;
  onSelect: (annotationId: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {annotations
        .filter((annotation) => annotation.page_number === pageNumber)
        .flatMap((annotation) => {
          if (!isAnnotationPosition(annotation.position)) {
            return [];
          }

          const rects =
            annotation.position.type === "area"
              ? [annotation.position.boundingRect]
              : annotation.position.rects;

          return rects.map((rect, index) => (
            <button
              key={`${annotation.id}-${index}`}
              type="button"
              className={cn(
                "pointer-events-auto absolute rounded-[2px] ring-1 transition-colors",
                selectedAnnotationId === annotation.id
                  ? "ring-foreground"
                  : "ring-transparent",
              )}
              style={{
                left: `${rect.left}%`,
                top: `${rect.top}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
                backgroundColor: hexToRgba(annotation.color, 0.28),
              }}
              onClick={() => onSelect(annotation.id)}
            >
              <span className="sr-only">Open annotation</span>
            </button>
          ));
        })}
    </div>
  );
}

function AnnotationRail({
  annotations,
  selectedAnnotation,
  scheduleId,
  paperId,
  currentUserId,
  onSelect,
  loading,
}: {
  annotations: PaperAnnotationRow[];
  selectedAnnotation: PaperAnnotationRow | null;
  scheduleId: string;
  paperId: string;
  currentUserId: string | null;
  onSelect: (annotationId: string) => void;
  loading: boolean;
}) {
  return (
    <aside className="min-h-0 space-y-3 overflow-y-auto rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Discussion</h3>
          <p className="text-xs text-muted-foreground">
            {annotations.length} anchored {annotations.length === 1 ? "item" : "items"}
          </p>
        </div>
        <MessageSquareIcon className="size-4 text-muted-foreground" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading discussion...</p>
      ) : null}

      {!loading && annotations.length === 0 ? (
        <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
          No anchored discussion yet.
        </p>
      ) : null}

      <div className="space-y-2">
        {annotations.map((annotation) => (
          <AnnotationCard
            key={annotation.id}
            annotation={annotation}
            selected={selectedAnnotation?.id === annotation.id}
            scheduleId={scheduleId}
            paperId={paperId}
            currentUserId={currentUserId}
            onSelect={() => onSelect(annotation.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function AnnotationCard({
  annotation,
  selected,
  scheduleId,
  paperId,
  currentUserId,
  onSelect,
}: {
  annotation: PaperAnnotationRow;
  selected: boolean;
  scheduleId: string;
  paperId: string;
  currentUserId: string | null;
  onSelect: () => void;
}) {
  const replies = annotation.paper_annotation_replies ?? [];

  return (
    <article
      className={cn(
        "rounded-md border p-3 transition-colors",
        selected ? "bg-muted/50" : "bg-background",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PixelAvatar
            avatarId={annotation.profiles?.avatar_id}
            color={annotation.profiles?.avatar_color}
            label={annotation.profiles?.display_name}
            className="size-7"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {annotation.profiles?.display_name ?? "Reader"}
            </p>
            <p className="text-xs text-muted-foreground">
              Page {annotation.page_number}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-xs capitalize"
          style={{
            backgroundColor: hexToRgba(annotation.color, 0.2),
            color: annotation.color,
          }}
        >
          {annotation.kind}
        </span>
      </div>

      {annotation.quote ? (
        <blockquote className="mt-3 border-l-2 pl-3 text-sm text-muted-foreground">
          {annotation.quote}
        </blockquote>
      ) : null}

      {annotation.body ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {annotation.body}
        </p>
      ) : null}

      {replies.length > 0 ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <PixelAvatar
                avatarId={reply.profiles?.avatar_id}
                color={reply.profiles?.avatar_color}
                label={reply.profiles?.display_name}
                className="size-6"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {reply.profiles?.display_name ?? "Reader"}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {reply.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {selected ? (
        <AnnotationReplyForm
          annotationId={annotation.id}
          scheduleId={scheduleId}
          paperId={paperId}
          currentUserId={currentUserId}
        />
      ) : null}
    </article>
  );
}

function AnnotationReplyForm({
  annotationId,
  scheduleId,
  paperId,
  currentUserId,
}: {
  annotationId: string;
  scheduleId: string;
  paperId: string;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () => {
      if (!currentUserId) {
        throw new Error("Sign in required.");
      }

      return createAnnotationReply({
        annotationId,
        body: body.trim(),
      });
    },
    onSuccess: async () => {
      setBody("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.annotations.list(scheduleId, paperId),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="mt-3 space-y-2 border-t pt-3" onClick={(event) => event.stopPropagation()}>
      <Textarea
        rows={2}
        value={body}
        placeholder="Reply"
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={create.isPending || !body.trim()}
          onClick={() => create.mutate()}
        >
          Reply
        </Button>
      </div>
    </div>
  );
}

function AnnotationComposer({
  pending,
  kind,
  body,
  saving,
  onKindChange,
  onBodyChange,
  onClose,
  onSave,
}: {
  pending: PendingAnnotation;
  kind: AnnotationKind;
  body: string;
  saving: boolean;
  onKindChange: (kind: AnnotationKind) => void;
  onBodyChange: (body: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const requiresBody = kind !== "highlight";

  return (
    <div
      className="fixed z-50 w-80 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{ left: pending.clientX, top: pending.clientY }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <select
          value={kind}
          className="h-8 rounded-md border bg-background px-2 text-sm"
          onChange={(event) => onKindChange(event.target.value as AnnotationKind)}
        >
          <option value="highlight">Highlight</option>
          <option value="question">Question</option>
          <option value="explanation">Explanation</option>
          <option value="note">Note</option>
        </select>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose}>
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      {pending.quote ? (
        <p className="mb-2 line-clamp-3 text-xs text-muted-foreground">
          {pending.quote}
        </p>
      ) : null}
      <Textarea
        rows={3}
        value={body}
        placeholder={kind === "highlight" ? "Optional note" : "Add context"}
        onChange={(event) => onBodyChange(event.target.value)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving || (requiresBody && !body.trim())}
          onClick={onSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function AreaDraftBox({ rect }: { rect: AnnotationRect }) {
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-[2px] border border-foreground bg-foreground/10"
      style={{
        left: `${rect.left}%`,
        top: `${rect.top}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
    />
  );
}

function PdfMessage({ children }: { children: ReactNode }) {
  return (
    <p className="p-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}

function PdfFallback({ browserUrl }: { browserUrl: string | null }) {
  return (
    <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
      <p>PDF preview is unavailable.</p>
      {browserUrl ? (
        <Button asChild size="sm" variant="outline" className="mt-3">
          <a href={browserUrl} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="size-4" />
            Open in browser
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function getDraftRect(draft: AreaDraft): AnnotationRect {
  const left = Math.min(draft.startX, draft.currentX);
  const top = Math.min(draft.startY, draft.currentY);
  const right = Math.max(draft.startX, draft.currentX);
  const bottom = Math.max(draft.startY, draft.currentY);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
