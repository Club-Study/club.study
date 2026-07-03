import { describe, expect, it } from "vitest";

import { formatWeekLabel, getMonday, isMondayDateString } from "@/lib/dates/week";

describe("week helpers", () => {
  it("gets the Monday for a week", () => {
    expect(getMonday(new Date("2026-07-02T12:00:00Z")).toISOString()).toBe(
      "2026-06-29T00:00:00.000Z",
    );
  });

  it("validates Monday date strings", () => {
    expect(isMondayDateString("2026-07-06")).toBe(true);
    expect(isMondayDateString("2026-07-07")).toBe(false);
    expect(isMondayDateString("not-a-date")).toBe(false);
  });

  it("formats week labels", () => {
    expect(formatWeekLabel("2026-07-06")).toBe("Jul 6, 2026");
  });
});
