import { describe, expect, it } from "vitest";

import {
  getPastPaperState,
  normalizeFeedSearch,
} from "@/features/dashboard/feed";

describe("normalizeFeedSearch", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeFeedSearch("  language\n\t models   ")).toBe(
      "language models",
    );
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeFeedSearch(" \n\t ")).toBe("");
  });

  it("preserves meaningful punctuation", () => {
    expect(normalizeFeedSearch('  "attention", 100%  ')).toBe(
      '"attention", 100%',
    );
  });
});

describe("getPastPaperState", () => {
  it("classifies only an explicit read status as read", () => {
    expect(getPastPaperState("read")).toBe("read");
  });

  it.each([null, "planned", "reading", "on_hold", "dropped"] as const)(
    "classifies %s as missed",
    (status) => {
      expect(getPastPaperState(status)).toBe("missed");
    },
  );
});
