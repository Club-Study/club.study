import { describe, expect, it } from "vitest";

import edgeSource from "../../supabase/functions/arxiv-lookup/index.ts?raw";
import supabaseConfig from "../../supabase/config.toml?raw";

describe("arXiv Edge security contract", () => {
  it("uses modern API keys and verifies the user server-side", () => {
    expect(supabaseConfig).toMatch(
      /\[functions\.arxiv-lookup\][\s\S]*?verify_jwt\s*=\s*false/,
    );
    expect(edgeSource).toContain("auth.getUser(token)");
    expect(edgeSource).toContain('defaultApiKey("SUPABASE_PUBLISHABLE_KEYS"');
    expect(edgeSource).toContain('defaultApiKey("SUPABASE_SECRET_KEYS"');
    expect(edgeSource).toContain("consume_arxiv_rate_limit");
  });

  it("uses explicit origins and bounded request/upstream bodies", () => {
    expect(edgeSource).not.toContain('"Access-Control-Allow-Origin": "*"');
    expect(edgeSource).toContain("maxBodyBytes = 4_096");
    expect(edgeSource).toContain("maxArxivResponseBytes = 1_000_000");
    expect(edgeSource).toContain("requestBodyTimeoutMs = 5_000");
    expect(edgeSource).toContain("AbortController");
  });

  it("maps import failures to curated statuses without returning database text", () => {
    expect(edgeSource).toContain('new RequestError(403, "You are no longer a member');
    expect(edgeSource).toContain('new RequestError(409, "That paper already exists.');
    expect(edgeSource).not.toContain("json({ error: error.message");
  });

  it("keeps the upstream timeout active through body streaming", () => {
    const fetchFunction = edgeSource.slice(
      edgeSource.indexOf("async function fetchArxivMetadata"),
      edgeSource.indexOf("async function readTextWithLimit"),
    );

    expect(fetchFunction.indexOf("await readTextWithLimit")).toBeGreaterThan(0);
    expect(fetchFunction.indexOf("clearTimeout(timeout)")).toBeGreaterThan(
      fetchFunction.indexOf("await readTextWithLimit"),
    );
  });
});
