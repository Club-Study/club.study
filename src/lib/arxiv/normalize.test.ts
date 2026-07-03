import { describe, expect, it } from "vitest";

import { isCanonicalArxivId, normalizeArxivInput } from "@/lib/arxiv/normalize";

describe("normalizeArxivInput", () => {
  it("normalizes raw versioned ids", () => {
    expect(normalizeArxivInput("2401.12345v2")).toEqual({
      arxivId: "2401.12345",
      abstractUrl: "https://arxiv.org/abs/2401.12345",
      pdfUrl: "https://arxiv.org/pdf/2401.12345",
    });
  });

  it("normalizes abs and pdf urls", () => {
    expect(normalizeArxivInput("https://arxiv.org/abs/cs/9901001v1").arxivId).toBe(
      "cs/9901001",
    );
    expect(normalizeArxivInput("https://arxiv.org/pdf/2401.12345.pdf").pdfUrl).toBe(
      "https://arxiv.org/pdf/2401.12345",
    );
  });

  it("rejects non-arxiv values", () => {
    expect(() => normalizeArxivInput("https://example.com/paper.pdf")).toThrow(
      /valid arXiv/,
    );
  });
});

describe("isCanonicalArxivId", () => {
  it("accepts canonical ids and rejects versions", () => {
    expect(isCanonicalArxivId("2401.12345")).toBe(true);
    expect(isCanonicalArxivId("2401.12345v2")).toBe(false);
  });
});
