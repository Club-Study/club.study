import type { PaperStatus } from "@/features/schedule/api";

export type FeedDensity = "comfortable" | "compact";
export type PastPaperFilter = "all" | "read" | "missed";
export type PastPaperState = Exclude<PastPaperFilter, "all">;

export function normalizeFeedSearch(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function getPastPaperState(
  status: PaperStatus | null,
): PastPaperState {
  return status === "read" ? "read" : "missed";
}
