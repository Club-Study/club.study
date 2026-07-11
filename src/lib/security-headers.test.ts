import { describe, expect, it } from "vitest";

import vercelConfig from "../../vercel.json";

describe("Vercel security headers", () => {
  it("defines a CSP compatible with Supabase, PDF workers, and external PDFs", () => {
    const headers = vercelConfig.headers[0]?.headers ?? [];
    const csp = headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://arxiv.org https://export.arxiv.org",
    );
    expect(csp).not.toContain("connect-src 'self' https: wss:");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
  });

  it("enables long-lived HTTPS transport security", () => {
    const headers = vercelConfig.headers[0]?.headers ?? [];
    const hsts = headers.find(
      (header) => header.key === "Strict-Transport-Security",
    )?.value;

    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
  });
});
