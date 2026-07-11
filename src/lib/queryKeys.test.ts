import { describe, expect, it } from "vitest";

import { queryKeys } from "@/lib/queryKeys";

describe("queryKeys", () => {
  it("keeps entity keys stable", () => {
    expect(queryKeys.clubs.detail("club-id")).toEqual(["clubs", "club-id"]);
    expect(queryKeys.schedule.progress("club-id")).toEqual([
      "schedule",
      "club-id",
      "progress",
    ]);
    expect(queryKeys.annotations.list("schedule-id", "paper-id")).toEqual([
      "annotations",
      "schedule-id",
      "paper-id",
    ]);
  });

  it("keeps the user-scoped club list beneath the clubs invalidation prefix", () => {
    expect(queryKeys.clubs.list("user-id")).toEqual([
      ...queryKeys.clubs.all,
      "list",
      "user-id",
    ]);
    expect(queryKeys.clubs.directory("user-id")).toEqual([
      ...queryKeys.clubs.all,
      "directory",
      "user-id",
    ]);
    expect(queryKeys.clubs.applications("club-id")).toEqual([
      ...queryKeys.clubs.all,
      "club-id",
      "applications",
    ]);
  });
});
