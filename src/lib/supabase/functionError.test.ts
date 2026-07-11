import { describe, expect, it } from "vitest";

import { functionInvocationError } from "@/lib/supabase/functionError";
import { SafeUserError, toUserMessage } from "@/lib/user-facing-error";

describe("functionInvocationError", () => {
  it("maps an HTTP function status without trusting its response body", async () => {
    const source = Object.assign(new Error("Edge Function returned a non-2xx status"), {
      context: new Response(JSON.stringify({ error: "Sign in required." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(functionInvocationError(source, "Import failed.")).resolves.toEqual(
      expect.objectContaining({
        name: "SafeUserError",
        message: "Sign in and try again.",
      }),
    );
  });

  it("uses the fallback for server errors regardless of response body", async () => {
    const source = Object.assign(new Error("HTTP failure"), {
      context: new Response(JSON.stringify({ error: "x".repeat(10_000) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    });

    await expect(
      functionInvocationError(source, "Import failed."),
    ).resolves.toBeInstanceOf(SafeUserError);
  });

  it("preserves a bounded rate-limit response for the user", async () => {
    const source = Object.assign(new Error("Edge Function returned a non-2xx status"), {
      context: new Response(
        JSON.stringify({ error: "Too many lookups. Try again later." }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    });

    const error = await functionInvocationError(source, "Lookup failed.");

    expect(toUserMessage(error, "lookup-paper")).toBe(
      "Too many arXiv requests. Try again in a few minutes.",
    );
  });

  it("maps request timeouts without trusting the response body", async () => {
    const source = Object.assign(new Error("Edge Function timed out"), {
      context: new Response(JSON.stringify({ error: "private database detail" }), {
        status: 408,
        headers: { "content-type": "application/json" },
      }),
    });

    const error = await functionInvocationError(source, "Lookup failed.");

    expect(error.message).toBe("The request timed out. Try again.");
    expect(error.message).not.toContain("database");
  });

  it("does not expose an unknown backend error message", async () => {
    const error = await functionInvocationError(
      new Error("relation private_tokens does not exist"),
      "Import failed.",
    );

    expect(error).not.toBeInstanceOf(SafeUserError);
    expect(toUserMessage(error, "lookup-paper")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("does not expose a bounded JSON message from a server failure", async () => {
    const source = Object.assign(new Error("Edge Function failed"), {
      context: new Response(
        JSON.stringify({ error: "relation private_tokens does not exist" }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      ),
    });

    const error = await functionInvocationError(source, "Import failed.");

    expect(toUserMessage(error, "lookup-paper")).toBe("Import failed.");
    expect(error.message).not.toContain("private_tokens");
  });
});
