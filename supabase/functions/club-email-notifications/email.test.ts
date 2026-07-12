import { describe, expect, it, vi } from "vitest";

import {
  createResendClubEmailSender,
  renderClubEmail,
  type ClubEmailNotification,
} from "./email.ts";

const notification: ClubEmailNotification = {
  notificationId: "11111111-1111-4111-8111-111111111111",
  notificationKind: "scheduled",
  recipientEmail: "ada@example.com",
  recipientName: "Ada <Lovelace>",
  clubId: "22222222-2222-4222-8222-222222222222",
  clubName: "Causal & Statistical Reading",
  scheduleId: "33333333-3333-4333-8333-333333333333",
  paperTitle: "A <paper> about causality\r\nBcc: unsafe@example.com",
  deadline: "2026-07-15",
  attemptCount: 1,
};

describe("renderClubEmail", () => {
  it("renders safe text and HTML with a canonical private paper link", () => {
    const rendered = renderClubEmail(notification, "https://cosearch.club/");

    expect(rendered.subject).toBe(
      "New club paper: A <paper> about causality Bcc: unsafe@example.com",
    );
    expect(rendered.text).toContain("Wednesday, 15 July 2026");
    expect(rendered.text).toContain(
      "https://cosearch.club/app/papers/33333333-3333-4333-8333-333333333333",
    );
    expect(rendered.html).toContain("Ada &lt;Lovelace&gt;");
    expect(rendered.html).toContain("A &lt;paper&gt; about causality");
    expect(rendered.html).toContain("Causal &amp; Statistical Reading");
    expect(rendered.html).not.toContain("<paper>");
  });

  it.each([
    ["reminder_3d", "Due in 3 days:"],
    ["reminder_1d", "Due tomorrow:"],
  ] as const)("renders the %s subject", (kind, subjectStart) => {
    expect(
      renderClubEmail(
        { ...notification, notificationKind: kind },
        "https://cosearch.club",
      ).subject,
    ).toMatch(subjectStart);
  });
});

describe("createResendClubEmailSender", () => {
  it("sends both email variants with a stable idempotency key", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "resend-message-id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const sender = createResendClubEmailSender({
      apiKey: "re_test_key",
      from: "cosearch <notifications@cosearch.club>",
      applicationUrl: "https://cosearch.club",
      fetchImplementation,
    });

    await expect(sender(notification)).resolves.toEqual({
      outcome: "sent",
      providerMessageId: "resend-message-id",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImplementation.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
      "Idempotency-Key":
        "club-email-notification-11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "cosearch <notifications@cosearch.club>",
      to: ["ada@example.com"],
      subject:
        "New club paper: A <paper> about causality Bcc: unsafe@example.com",
    });
  });

  it.each([408, 409, 425, 429, 500, 503])(
    "retries a temporary HTTP %s response",
    async (status) => {
      const sender = createResendClubEmailSender({
        apiKey: "re_test_key",
        from: "notifications@cosearch.club",
        applicationUrl: "https://cosearch.club",
        fetchImplementation: vi.fn().mockResolvedValue(new Response(null, { status })),
      });

      await expect(sender(notification)).resolves.toEqual({
        outcome: "retry",
        error: `Resend returned HTTP ${status}.`,
      });
    },
  );

  it("fails a terminal provider rejection without exposing its body", async () => {
    const sender = createResendClubEmailSender({
      apiKey: "re_test_key",
      from: "notifications@cosearch.club",
      applicationUrl: "https://cosearch.club",
      fetchImplementation: vi.fn().mockResolvedValue(
        new Response("recipient and provider internals", { status: 422 }),
      ),
    });

    await expect(sender(notification)).resolves.toEqual({
      outcome: "failed",
      error: "Resend returned HTTP 422.",
    });
  });

  it("retries network failures and successful responses without an id", async () => {
    const networkSender = createResendClubEmailSender({
      apiKey: "re_test_key",
      from: "notifications@cosearch.club",
      applicationUrl: "https://cosearch.club",
      fetchImplementation: vi.fn().mockRejectedValue(new Error("private detail")),
    });
    const missingIdSender = createResendClubEmailSender({
      apiKey: "re_test_key",
      from: "notifications@cosearch.club",
      applicationUrl: "https://cosearch.club",
      fetchImplementation: vi.fn().mockResolvedValue(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    });

    await expect(networkSender(notification)).resolves.toMatchObject({
      outcome: "retry",
    });
    await expect(missingIdSender(notification)).resolves.toEqual({
      outcome: "retry",
      error: "Resend returned no message identifier.",
    });
  });

  it("rejects insecure non-local endpoints", () => {
    expect(() =>
      createResendClubEmailSender({
        apiKey: "re_test_key",
        from: "notifications@cosearch.club",
        applicationUrl: "http://cosearch.club",
      }),
    ).toThrow("HTTPS");
  });

  it("rejects a calendar date that only looks ISO-shaped", () => {
    expect(() =>
      renderClubEmail(
        { ...notification, deadline: "2026-02-31" },
        "https://cosearch.club",
      ),
    ).toThrow("deadline is invalid");
  });
});
