import { describe, expect, it } from "vitest";

import {
  SafeUserError,
  getUserFacingError,
  toUserMessage,
} from "@/lib/user-facing-error";

describe("getUserFacingError", () => {
  it("maps a club uniqueness failure to a safe field-level conflict", () => {
    expect(
      getUserFacingError(
        { code: "23505", message: "sensitive database details" },
        "create-club",
      ),
    ).toEqual({
      kind: "club-name-conflict",
      message: "A club with this name already exists.",
    });
  });

  it("maps duplicate schedule and personal-paper failures by operation", () => {
    expect(
      getUserFacingError({ code: "23505" }, "schedule-paper"),
    ).toMatchObject({
      kind: "duplicate-schedule",
    });
    expect(
      getUserFacingError({ code: "23505" }, "add-personal-paper"),
    ).toMatchObject({
      kind: "duplicate-personal-paper",
    });
  });

  it.each([
    [{ code: "23514" }, "invalid-input"],
    [{ code: "42501" }, "forbidden"],
    [{ status: 401 }, "unauthenticated"],
    [{ code: "PGRST116" }, "not-found"],
    [new TypeError("Failed to fetch"), "network"],
  ] as const)("maps %# without exposing raw details", (error, kind) => {
    expect(getUserFacingError(error).kind).toBe(kind);
  });

  it("preserves only explicitly safe local validation messages", () => {
    expect(toUserMessage(new SafeUserError("Choose a paper."))).toBe(
      "Choose a paper.",
    );
  });

  it("never returns an unknown raw backend message", () => {
    const raw = "duplicate key value violates unique constraint clubs_slug_key";

    expect(toUserMessage(new Error(raw))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(toUserMessage(new Error(raw))).not.toContain("clubs_slug_key");
  });
});
