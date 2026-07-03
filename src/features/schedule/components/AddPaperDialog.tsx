import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  lookupArxivMetadata,
  scheduleArxivPaper,
  scheduleManualPaper,
  type ArxivMetadata,
} from "@/features/schedule/api";
import { queryKeys } from "@/lib/queryKeys";
import { getCurrentWeekStart, isMondayDateString } from "@/lib/dates/week";
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

type Mode = "arxiv" | "manual";

export function AddPaperDialog({ clubId }: { clubId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("arxiv");
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart());
  const [arxivInput, setArxivInput] = useState("");
  const [metadata, setMetadata] = useState<ArxivMetadata | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthors, setManualAuthors] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualAbstract, setManualAbstract] = useState("");

  const lookup = useMutation({
    mutationFn: () => lookupArxivMetadata(arxivInput),
    onSuccess: setMetadata,
    onError: (error) => toast.error(error.message),
  });
  const scheduleArxiv = useMutation({
    mutationFn: () => {
      if (!metadata) {
        throw new Error("Look up arXiv metadata first.");
      }

      validateWeek(weekStart);
      return scheduleArxivPaper({
        clubId,
        weekStart,
        metadata,
      });
    },
    onSuccess: () => closeAfterSchedule(queryClient, clubId, setOpen),
    onError: (error) => toast.error(error.message),
  });
  const scheduleManual = useMutation({
    mutationFn: () => {
      validateWeek(weekStart);
      return scheduleManualPaper({
        clubId,
        weekStart,
        metadata: {
          title: manualTitle.trim(),
          authors: splitAuthors(manualAuthors),
          abstract: manualAbstract.trim() || null,
          doi: null,
          license: null,
          external_url: manualUrl.trim(),
        },
      });
    },
    onSuccess: () => closeAfterSchedule(queryClient, clubId, setOpen),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          Schedule paper
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schedule paper</DialogTitle>
          <DialogDescription>
            Add metadata for one primary paper in a Monday week.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="week-start">Week start</Label>
            <Input
              id="week-start"
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
            />
          </div>

          <div className="flex rounded-md border p-1 text-sm">
            <ModeButton active={mode === "arxiv"} onClick={() => setMode("arxiv")}>
              arXiv
            </ModeButton>
            <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
              Manual
            </ModeButton>
          </div>

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
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {metadata.abstract}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
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
                onChange={setManualUrl}
              />
              <div className="grid gap-2">
                <Label htmlFor="manual-abstract">Abstract</Label>
                <Textarea
                  id="manual-abstract"
                  value={manualAbstract}
                  rows={4}
                  onChange={(event) => setManualAbstract(event.target.value)}
                />
              </div>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={scheduleArxiv.isPending || scheduleManual.isPending}
            onClick={() =>
              mode === "arxiv" ? scheduleArxiv.mutate() : scheduleManual.mutate()
            }
          >
            Schedule
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
  children: React.ReactNode;
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
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function validateWeek(value: string) {
  if (!isMondayDateString(value)) {
    throw new Error("Week start must be a Monday.");
  }
}

function splitAuthors(value: string) {
  return value
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean);
}

async function closeAfterSchedule(
  queryClient: ReturnType<typeof useQueryClient>,
  clubId: string,
  setOpen: (open: boolean) => void,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.schedule.list(clubId) }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.schedule.progress(clubId),
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.schedule.dashboardRoot }),
  ]);
  toast.success("Paper scheduled");
  setOpen(false);
}
