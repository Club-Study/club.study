import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";

import { KatexText } from "@/components/katex-text";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/features/auth/queries";
import {
  addPersonalArxivPaper,
  addPersonalManualPaper,
  type ProfileOverview,
  type ProfileScheduledPaper,
} from "@/features/profile/api";
import { profileOverviewQueryOptions } from "@/features/profile/queries";
import {
  lookupArxivMetadata,
  scheduleArxivPaper,
  scheduleExistingPaper,
  scheduleManualPaper,
  type ArxivMetadata,
  type Paper,
} from "@/features/schedule/api";
import { formatOptionalDateLabel, toDateInputValue } from "@/lib/dates/week";
import { MAX_HTTP_URL_LENGTH, normalizeHttpUrl } from "@/lib/http-url";
import { queryKeys } from "@/lib/queryKeys";
import { SafeUserError, toUserMessage } from "@/lib/user-facing-error";

type Mode = "library" | "arxiv" | "manual";

type LibraryPaperOption = {
  paperId: string;
  title: string;
  authors: string[];
  sourceType: Paper["source_type"];
  sourceLabel: string;
  detailLabel: string;
  sortKey: string;
};

export function AddPaperDialog({ clubId }: { clubId?: string }) {
  const isClubMode = clubId !== undefined;
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(isClubMode ? "library" : "arxiv");
  const [deadline, setDeadline] = useState("");
  const [selectedPaperId, setSelectedPaperId] = useState("");
  const [arxivInput, setArxivInput] = useState("");
  const [metadata, setMetadata] = useState<ArxivMetadata | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualAbstract, setManualAbstract] = useState("");
  const overview = useQuery({
    ...profileOverviewQueryOptions(user.data?.id ?? ""),
    enabled: open && isClubMode && mode === "library" && Boolean(user.data?.id),
  });
  const libraryPapers = useMemo(
    () => (overview.data ? buildLibraryPaperOptions(overview.data) : []),
    [overview.data],
  );

  if (user.error) {
    throw user.error;
  }

  if (overview.error) {
    throw overview.error;
  }

  const lookup = useMutation({
    mutationFn: () => lookupArxivMetadata(arxivInput),
    onSuccess: setMetadata,
    onError: (error) =>
      toast.error(
        toUserMessage(error, "lookup-paper", "Could not look up that arXiv paper."),
      ),
  });
  const addArxiv = useMutation<unknown, Error>({
    mutationFn: () => {
      if (!metadata) {
        throw new SafeUserError("Look up arXiv metadata first.");
      }

      const parsedDeadline = optionalDateInputValue(deadline);

      if (clubId !== undefined) {
        return scheduleArxivPaper({
          clubId,
          deadline: parsedDeadline,
          metadata,
        });
      }

      return addPersonalArxivPaper(metadata, parsedDeadline);
    },
    onSuccess: async () => closeAfterAdd(queryClient, clubId, setOpen, resetForm),
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          isClubMode ? "schedule-paper" : "add-personal-paper",
          isClubMode
            ? "Could not add the paper to this club."
            : "Could not add the paper to your profile.",
        ),
      ),
  });
  const addManual = useMutation<unknown, Error>({
    mutationFn: () => {
      const title = manualTitle.trim();
      if (!title) {
        throw new SafeUserError("Enter a paper title.");
      }

      if (title.length > 500) {
        throw new SafeUserError("Paper title must be 500 characters or fewer.");
      }

      const authors = splitAuthors(manualAuthors);
      if (authors.length > 100) {
        throw new SafeUserError("Add at most 100 authors.");
      }

      if (authors.some((author) => author.length > 300)) {
        throw new SafeUserError(
          "Each author name must be 300 characters or fewer.",
        );
      }

      const abstract = manualAbstract.trim();
      if (abstract.length > 100_000) {
        throw new SafeUserError(
          "The abstract must be 100,000 characters or fewer.",
        );
      }

      const values = {
        title,
        authors,
        abstract: abstract || null,
        doi: null,
        license: null,
        external_url: normalizeHttpUrl(manualUrl),
      };
      const parsedDeadline = optionalDateInputValue(deadline);

      if (clubId !== undefined) {
        return scheduleManualPaper({
          clubId,
          deadline: parsedDeadline,
          metadata: values,
        });
      }

      return addPersonalManualPaper(values, parsedDeadline);
    },
    onSuccess: async () => closeAfterAdd(queryClient, clubId, setOpen, resetForm),
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          isClubMode ? "schedule-paper" : "add-personal-paper",
          isClubMode
            ? "Could not add the paper to this club."
            : "Could not add the paper to your profile.",
        ),
      ),
  });
  const addExisting = useMutation<unknown, Error>({
    mutationFn: () => {
      if (clubId === undefined) {
        throw new SafeUserError("Existing papers can only be added to a club.");
      }

      const paperId = selectedPaperId || libraryPapers[0]?.paperId;

      if (!paperId) {
        throw new SafeUserError("Choose a paper from your lists.");
      }

      return scheduleExistingPaper({
        clubId,
        deadline: optionalDateInputValue(deadline),
        paperId,
      });
    },
    onSuccess: async () => closeAfterAdd(queryClient, clubId, setOpen, resetForm),
    onError: (error) =>
      toast.error(
        toUserMessage(
          error,
          "schedule-paper",
          "Could not add the paper to this club.",
        ),
      ),
  });

  function resetForm() {
    setMode(isClubMode ? "library" : "arxiv");
    setDeadline("");
    setSelectedPaperId("");
    setArxivInput("");
    setMetadata(null);
    setManualTitle("");
    setManualAuthors("");
    setManualUrl("");
    setManualAbstract("");
  }

  const isSubmitting =
    addArxiv.isPending || addManual.isPending || addExisting.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={isClubMode ? "sm" : "xs"}
          variant={isClubMode ? "default" : "outline"}
          className={isClubMode ? undefined : "h-7"}
        >
          <PlusIcon aria-hidden="true" />
          Add paper
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add paper</DialogTitle>
          <DialogDescription>
            {isClubMode
              ? "Add a paper to this club. Deadline optional."
              : "Save a paper to your profile. Deadline optional."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="paper-deadline">Deadline (optional)</Label>
            <Input
              id="paper-deadline"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>

          <div className="flex rounded-md border p-1 text-sm">
            {isClubMode ? (
              <ModeButton active={mode === "library"} onClick={() => setMode("library")}>
                From lists
              </ModeButton>
            ) : null}
            <ModeButton active={mode === "arxiv"} onClick={() => setMode("arxiv")}>
              arXiv
            </ModeButton>
            <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
              Manual
            </ModeButton>
          </div>

          {mode === "library" ? (
            <LibraryPaperPicker
              papers={libraryPapers}
              selectedPaperId={selectedPaperId || (libraryPapers[0]?.paperId ?? "")}
              isLoading={overview.isLoading}
              onSelect={setSelectedPaperId}
            />
          ) : null}

          {mode === "arxiv" ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="arxiv-input">arXiv URL or ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="arxiv-input"
                    value={arxivInput}
                    placeholder="https://arxiv.org/abs/2401.12345"
                    onChange={(event) => {
                      setArxivInput(event.target.value);
                      setMetadata(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={lookup.isPending}
                    onClick={() => lookup.mutate()}
                  >
                    Lookup
                  </Button>
                </div>
              </div>
              {metadata ? (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-sm font-medium">{metadata.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {metadata.authors.join(", ")}
                  </p>
                  {metadata.abstract ? (
                    <KatexText
                      text={metadata.abstract}
                      className="mt-2 line-clamp-3 text-sm text-muted-foreground"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "manual" ? (
            <div className="grid gap-3">
              <Field label="Title" value={manualTitle} onChange={setManualTitle} />
              <Field
                label="Authors"
                value={manualAuthors}
                placeholder="Ada Lovelace, Alan Turing"
                onChange={setManualAuthors}
              />
              <Field
                label="External URL"
                value={manualUrl}
                placeholder="https://example.com/paper"
                type="url"
                maxLength={MAX_HTTP_URL_LENGTH}
                onChange={setManualUrl}
              />
              <div className="grid gap-2">
                <Label htmlFor="manual-abstract">Abstract</Label>
                <Textarea
                  id="manual-abstract"
                  value={manualAbstract}
                  maxLength={100_000}
                  rows={4}
                  onChange={(event) => setManualAbstract(event.target.value)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={isSubmitting || (mode === "library" && overview.isLoading)}
            onClick={() => {
              if (mode === "library") {
                addExisting.mutate();
                return;
              }

              if (mode === "arxiv") {
                addArxiv.mutate();
                return;
              }

              addManual.mutate();
            }}
          >
            Add paper
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex-1 rounded-sm px-3 py-1.5 ${
        active ? "bg-background shadow-xs" : "text-muted-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: ComponentProps<"input">["type"];
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function LibraryPaperPicker({
  papers,
  selectedPaperId,
  isLoading,
  onSelect,
}: {
  papers: LibraryPaperOption[];
  selectedPaperId: string;
  isLoading: boolean;
  onSelect: (paperId: string) => void;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your papers...</p>;
  }

  if (papers.length === 0) {
    return (
      <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        No papers in your profile lists yet.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <Label>Your papers</Label>
      <div className="max-h-72 overflow-y-auto rounded-md border">
        {papers.map((paper) => (
          <button
            key={paper.paperId}
            type="button"
            aria-pressed={paper.paperId === selectedPaperId}
            className="block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/35 aria-pressed:bg-muted/50"
            onClick={() => onSelect(paper.paperId)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{paper.title}</p>
              <span className="text-xs text-muted-foreground">
                {paper.sourceLabel}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{paper.detailLabel}</span>
              <span>{paper.sourceType}</span>
              <span>{formatAuthors(paper.authors)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function optionalDateInputValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new SafeUserError("Deadline must be a valid date.");
  }

  const parsedDate = new Date(`${trimmed}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    toDateInputValue(parsedDate) !== trimmed
  ) {
    throw new SafeUserError("Deadline must be a valid date.");
  }

  return trimmed;
}

function splitAuthors(value: string) {
  return value
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean);
}

function buildLibraryPaperOptions(overview: ProfileOverview) {
  const seenPaperIds = new Set<string>();
  const options: LibraryPaperOption[] = [];

  for (const personalPaper of overview.personalPapers) {
    addLibraryPaperOption(
      options,
      seenPaperIds,
      personalPaper.papers,
      "Personal",
      `${formatLibraryStatus(personalPaper.status)} · ${formatOptionalDateLabel(
        personalPaper.deadline,
      )}`,
      personalPaper.deadline ?? personalPaper.created_at,
    );
  }

  for (const schedule of overview.scheduledPapers) {
    addLibraryPaperOption(
      options,
      seenPaperIds,
      schedule.papers,
      schedule.clubs.name,
      `${formatLibraryStatus(schedule.status)} · ${formatOptionalDateLabel(
        schedule.week_start,
      )}`,
      schedule.week_start ?? schedule.created_at,
    );
  }

  return options.sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

function formatLibraryStatus(status: ProfileScheduledPaper["status"]) {
  if (status === "on_hold") {
    return "On hold";
  }

  if (status === "read") {
    return "Read";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function addLibraryPaperOption(
  options: LibraryPaperOption[],
  seenPaperIds: Set<string>,
  paper: LibraryPaperOptionSource,
  sourceLabel: string,
  detailLabel: string,
  sortKey: string,
) {
  if (seenPaperIds.has(paper.id)) {
    return;
  }

  seenPaperIds.add(paper.id);
  options.push({
    paperId: paper.id,
    title: paper.title,
    authors: paper.authors,
    sourceType: paper.source_type,
    sourceLabel,
    detailLabel,
    sortKey,
  });
}

function formatAuthors(authors: string[]) {
  if (!Array.isArray(authors)) {
    throw new Error("Paper authors must be an array.");
  }

  return authors
    .map((author) => {
      if (typeof author !== "string") {
        throw new Error("Paper authors must be strings.");
      }

      return author;
    })
    .slice(0, 3)
    .join(", ");
}

async function closeAfterAdd(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string | undefined,
  setOpen: (open: boolean) => void,
  resetForm: () => void,
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.profile.root }),
  ];

  if (clubId !== undefined) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.list(clubId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule.progress(clubId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.dashboardRoot }),
    );
  }

  await Promise.all(invalidations);
  toast.success(clubId === undefined ? "Paper added" : "Paper added to club");
  setOpen(false);
  resetForm();
}

type LibraryPaperOptionSource = {
  id: string;
  title: string;
  authors: string[];
  source_type: Paper["source_type"];
};
