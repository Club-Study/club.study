import { BookOpenIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

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
import type { PaperStatus } from "@/features/schedule/api";
import { toUserMessage } from "@/lib/user-facing-error";

const paperStatusOptions: Array<{ value: PaperStatus; label: string }> = [
  { value: "planned", label: "Planned" },
  { value: "reading", label: "Reading" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "read", label: "Read" },
];

export function LogReadingSessionDialog({
  onSave,
  currentPagesRead,
  totalPages,
  status,
  triggerLabel = "Log pages",
  triggerSize = "sm",
  triggerClassName,
  disabled = false,
}: {
  onSave: (values: {
    currentPage: number;
    totalPages: number;
    status: PaperStatus;
  }) => Promise<unknown>;
  currentPagesRead: number;
  totalPages: number | null;
  status: PaperStatus;
  triggerLabel?: string;
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("");
  const [totalPageCount, setTotalPageCount] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PaperStatus>(status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setCurrentPage(String(currentPagesRead));
    setTotalPageCount(totalPages === null ? "" : String(totalPages));
    setSelectedStatus(status);
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetForm();
    }

    setOpen(nextOpen);
  }

  async function submit() {
    const parsedCurrentPage = parseWholeNumber(currentPage, "Current page");
    const parsedTotalPages = parseWholeNumber(totalPageCount, "Total pages");

    if (parsedCurrentPage === null || parsedTotalPages === null) {
      setError("Current page and total pages must be whole numbers.");
      return;
    }

    if (parsedCurrentPage < 0) {
      setError("Current page cannot be negative.");
      return;
    }

    if (parsedTotalPages < 1) {
      setError("Total pages must be at least 1.");
      return;
    }

    if (parsedTotalPages > 100_000) {
      setError("Total pages cannot exceed 100,000.");
      return;
    }

    if (parsedCurrentPage > parsedTotalPages) {
      setError("Current page cannot exceed total pages.");
      return;
    }

    if (selectedStatus === "read" && parsedCurrentPage !== parsedTotalPages) {
      setError("Current page must equal total pages to mark the paper read.");
      return;
    }

    if (selectedStatus === "planned" && parsedCurrentPage > 0) {
      setError(
        "Planned papers cannot have logged pages. Choose Reading or set current page to 0.",
      );
      return;
    }

    if (parsedCurrentPage < currentPagesRead) {
      setError("Current page cannot be less than your logged page count.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSave({
        currentPage: parsedCurrentPage,
        totalPages: parsedTotalPages,
        status: selectedStatus,
      });
      setError(null);
      setOpen(false);
    } catch (submitError) {
      if (!(submitError instanceof Error)) {
        throw submitError;
      }

      setError(
        toUserMessage(
          submitError,
          "reading-progress",
          "Could not save reading progress. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={triggerSize}
          variant="outline"
          className={triggerClassName}
          disabled={disabled}
        >
          <BookOpenIcon aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update reading progress</DialogTitle>
          <DialogDescription>
            {totalPages === null
              ? `You have logged ${currentPagesRead} pages.`
              : `You have logged ${currentPagesRead} of ${totalPages} pages.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="grid gap-2">
              <Label htmlFor="current-page">Current page</Label>
              <Input
                id="current-page"
                inputMode="numeric"
                type="number"
                min={0}
                step={1}
                value={currentPage}
                onChange={(event) => {
                  setCurrentPage(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <span className="pb-2 text-sm text-muted-foreground">of</span>
            <div className="grid gap-2">
              <Label htmlFor="total-pages">Total pages</Label>
              <Input
                id="total-pages"
                inputMode="numeric"
                type="number"
                min={1}
                max={100_000}
                step={1}
                value={totalPageCount}
                onChange={(event) => {
                  setTotalPageCount(event.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="paper-status">Status</Label>
            <select
              id="paper-status"
              value={selectedStatus}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onChange={(event) => {
                setSelectedStatus(event.target.value as PaperStatus);
                setError(null);
              }}
            >
              {paperStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" disabled={isSubmitting} onClick={submit}>
            Save progress
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseWholeNumber(value: string, fieldName: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`${fieldName} is too large.`);
  }

  return parsedValue;
}
