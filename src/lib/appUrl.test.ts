import { describe, expect, it } from "vitest";

import { buildAuthCallbackUrl, resolveAppBaseUrl } from "@/lib/appUrl";

describe("resolveAppBaseUrl", () => {
  it("uses the canonical domain in production even when legacy Vercel config remains", () => {
    expect(
      resolveAppBaseUrl({
        isProduction: true,
        configuredUrl: "https://club-study.vercel.app",
        currentOrigin: "https://club-study.vercel.app",
      }),
    ).toBe("https://cosearch.club/");
  });

  it("keeps the configured local origin during development", () => {
    expect(
      resolveAppBaseUrl({
        isProduction: false,
        configuredUrl: "http://127.0.0.1:5173",
        currentOrigin: "http://127.0.0.1:5173",
      }),
    ).toBe("http://127.0.0.1:5173/");
  });

  it("falls back to the current origin outside production", () => {
    expect(
      resolveAppBaseUrl({
        isProduction: false,
        configuredUrl: undefined,
        currentOrigin: "http://localhost:4173",
      }),
    ).toBe("http://localhost:4173/");
  });

  it("rejects non-http application URLs", () => {
    expect(() =>
      resolveAppBaseUrl({
        isProduction: false,
        configuredUrl: "javascript:alert(1)",
        currentOrigin: undefined,
      }),
    ).toThrow("VITE_APP_URL must use http or https.");
  });

  it("carries a validated in-app destination across an origin change", () => {
    const callbackUrl = new URL(
      buildAuthCallbackUrl("/invites/0123456789abcdef"),
    );

    expect(callbackUrl.pathname).toBe("/auth/callback");
    expect(callbackUrl.searchParams.get("redirect")).toBe(
      "/invites/0123456789abcdef",
    );
  });
});
