import { describe, expect, it } from "vitest";

import {
  MAX_HTTP_URL_LENGTH,
  normalizeEmbeddablePdfUrl,
  normalizeHttpUrl,
} from "@/lib/http-url";

describe("normalizeHttpUrl", () => {
  it("normalizes absolute HTTP and HTTPS URLs", () => {
    expect(normalizeHttpUrl("  HTTPS://Example.com/paper?q=1  ")).toBe(
      "https://example.com/paper?q=1",
    );
    expect(normalizeHttpUrl("http://example.com")).toBe("http://example.com/");
    expect(
      normalizeHttpUrl("HTTPS://Example.com:443/a/../paper#section"),
    ).toBe("https://example.com/paper");
  });

  it.each([
    "",
    "/paper.pdf",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/paper.pdf",
    "https://user:password@example.com/paper",
  ])("rejects unsafe URL %s", (value) => {
    expect(() => normalizeHttpUrl(value)).toThrow(
      "Enter a valid HTTP or HTTPS URL.",
    );
  });

  it("rejects oversized URLs", () => {
    expect(() =>
      normalizeHttpUrl(`https://example.com/${"a".repeat(MAX_HTTP_URL_LENGTH)}`),
    ).toThrow("URL is too long.");
  });
});

describe("normalizeEmbeddablePdfUrl", () => {
  it("allows public HTTPS PDF locations", () => {
    expect(
      normalizeEmbeddablePdfUrl("HTTPS://arxiv.org/pdf/2401.12345#page=2"),
    ).toBe("https://arxiv.org/pdf/2401.12345");
  });

  it.each([
    "http://example.com/paper.pdf",
    "https://example.com/paper.pdf",
    "https://arxiv.org:8443/pdf/2401.12345",
    "https://arxiv.org/abs/2401.12345",
    "https://arxiv.org.evil.example/pdf/2401.12345",
    "https://localhost/paper.pdf",
    "https://localhost./paper.pdf",
    "https://intranet/paper.pdf",
    "https://intranet./paper.pdf",
    "https://research.internal/paper.pdf",
    "https://research.internal./paper.pdf",
    "https://127.0.0.1/paper.pdf",
    "https://0177.0.0.1/paper.pdf",
    "https://10.0.0.1/paper.pdf",
    "https://169.254.169.254/paper.pdf",
    "https://172.16.0.1/paper.pdf",
    "https://192.168.1.1/paper.pdf",
    "https://[::1]/paper.pdf",
    "https://[fd00::1]/paper.pdf",
  ])("rejects a non-public embedded PDF URL %s", (value) => {
    expect(() => normalizeEmbeddablePdfUrl(value)).toThrow(
      "Only canonical arXiv PDFs can be embedded safely.",
    );
  });
});
