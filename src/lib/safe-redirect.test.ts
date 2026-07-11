import { describe, expect, it } from "vitest";

import { safeAppRedirect } from "@/lib/safe-redirect";

const origin = "https://club.study";

describe("safeAppRedirect", () => {
  it.each([
    "/app",
    "/app/profile?tab=reading#papers",
    "/invites/0123456789abcdef",
  ])("allows same-origin application route %s", (value) => {
    expect(safeAppRedirect(value, origin)).toBe(value);
  });

  it.each([
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example/app",
    "/%2f%2fevil.example/app",
    "/%5cevil.example/app",
    "/app/%0aevil",
    "/sign-in",
    "/auth/callback",
    "/unrelated",
    "app/profile",
  ])("rejects unsafe or unrelated redirect %s", (value) => {
    expect(safeAppRedirect(value, origin)).toBe("/app");
  });

  it("rejects malformed encoding", () => {
    expect(safeAppRedirect("/app/%E0%A4%A", origin)).toBe("/app");
  });
});
