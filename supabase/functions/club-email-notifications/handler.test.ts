import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClubEmailSender } from "./email.ts";
import {
  createClubEmailNotificationHandler,
  type ClaimedClubEmailNotification,
  type ClubEmailNotificationStore,
} from "./handler.ts";

const cronSecret = "0123456789abcdef0123456789abcdef";
const fixedNow = new Date("2026-07-12T07:00:00.000Z");
const claim: ClaimedClubEmailNotification = {
  notification_id: "11111111-1111-4111-8111-111111111111",
  notification_kind: "reminder_3d",
  recipient_email: "ada@example.com",
  recipient_name: "Ada Lovelace",
  club_id: "22222222-2222-4222-8222-222222222222",
  club_name: "Causal Reading",
  schedule_id: "33333333-3333-4333-8333-333333333333",
  paper_title: "A causal paper",
  deadline: "2026-07-15",
  attempt_count: 1,
};

const state = vi.hoisted(() => ({
  queueDue: vi.fn(),
  claim: vi.fn(),
  resolve: vi.fn(),
  send: vi.fn(),
  reportError: vi.fn(),
}));

function request(secret = cronSecret) {
  return new Request("https://example.supabase.co/functions/v1/club-email-notifications", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
}

function handler() {
  const store: ClubEmailNotificationStore = {
    queueDue: state.queueDue,
    claim: state.claim,
    resolve: state.resolve,
  };
  return createClubEmailNotificationHandler({
    cronSecret,
    store,
    sender: state.send as ClubEmailSender,
    now: () => fixedNow,
    reportError: state.reportError,
  });
}

describe("createClubEmailNotificationHandler", () => {
  beforeEach(() => {
    state.queueDue.mockReset().mockResolvedValue(0);
    state.claim.mockReset().mockResolvedValue([]);
    state.resolve.mockReset().mockResolvedValue(true);
    state.send.mockReset().mockResolvedValue({
      outcome: "sent",
      providerMessageId: "resend-id",
    });
    state.reportError.mockReset();
  });

  it("rejects non-POST and unauthenticated requests before database access", async () => {
    const run = handler();
    const methodResponse = await run(
      new Request("https://example.supabase.co/functions/v1/club-email-notifications"),
    );
    const unauthorizedResponse = await run(request("wrong-secret"));

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("Allow")).toBe("POST");
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({ error: "Unauthorized." });
    expect(state.queueDue).not.toHaveBeenCalled();
    expect(state.claim).not.toHaveBeenCalled();
  });

  it("queues, claims, sends, and resolves without returning recipient data", async () => {
    state.queueDue.mockResolvedValue(2);
    state.claim.mockResolvedValue([claim]);

    const response = await handler()(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      queued: 2,
      claimed: 1,
      sent: 1,
      retried: 0,
      failed: 0,
      cancelled: 0,
      resolutionFailed: 0,
    });
    expect(state.queueDue).toHaveBeenCalledWith(fixedNow.toISOString());
    expect(state.claim).toHaveBeenCalledWith(25, fixedNow.toISOString());
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: claim.notification_id,
        recipientEmail: claim.recipient_email,
        notificationKind: "reminder_3d",
      }),
    );
    expect(state.resolve).toHaveBeenCalledWith({
      notificationId: claim.notification_id,
      outcome: "sent",
      providerMessageId: "resend-id",
      now: fixedNow.toISOString(),
    });
  });

  it("cancels unconfirmed recipients without calling the provider", async () => {
    state.claim.mockResolvedValue([{ ...claim, recipient_email: null }]);

    const response = await handler()(request());

    expect(await response.json()).toMatchObject({ cancelled: 1, sent: 0 });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.resolve).toHaveBeenCalledWith({
      notificationId: claim.notification_id,
      outcome: "cancelled",
      now: fixedNow.toISOString(),
    });
  });

  it("retries temporary failures with bounded backoff", async () => {
    state.claim.mockResolvedValue([claim]);
    state.send.mockResolvedValue({
      outcome: "retry",
      error: "Resend returned HTTP 429.",
    });

    const response = await handler()(request());

    expect(await response.json()).toMatchObject({ retried: 1, failed: 0 });
    expect(state.resolve).toHaveBeenCalledWith({
      notificationId: claim.notification_id,
      outcome: "retry",
      error: "Resend returned HTTP 429.",
      retryAt: "2026-07-12T07:05:00.000Z",
      now: fixedNow.toISOString(),
    });
  });

  it("marks the fifth temporary failure as terminal", async () => {
    state.claim.mockResolvedValue([{ ...claim, attempt_count: 5 }]);
    state.send.mockResolvedValue({
      outcome: "retry",
      error: "Resend returned HTTP 503.",
    });

    const response = await handler()(request());

    expect(await response.json()).toMatchObject({ failed: 1, retried: 0 });
    expect(state.resolve).toHaveBeenCalledWith({
      notificationId: claim.notification_id,
      outcome: "failed",
      error: "Resend returned HTTP 503.",
      now: fixedNow.toISOString(),
    });
  });

  it("reports resolution races in counts so the lock can recover safely", async () => {
    state.claim.mockResolvedValue([claim]);
    state.resolve.mockResolvedValue(false);

    const response = await handler()(request());

    expect(await response.json()).toMatchObject({
      sent: 0,
      resolutionFailed: 1,
    });
  });

  it("marks malformed claimed data failed without aborting the invocation", async () => {
    state.claim.mockResolvedValue([{ ...claim, paper_title: "" }]);

    const response = await handler()(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ failed: 1 });
    expect(state.send).not.toHaveBeenCalled();
    expect(state.resolve).toHaveBeenCalledWith({
      notificationId: claim.notification_id,
      outcome: "failed",
      error: "Claimed notification data was invalid.",
      now: fixedNow.toISOString(),
    });
  });

  it("returns a generic error when queueing or claiming fails", async () => {
    state.queueDue.mockRejectedValue(new Error("private database details"));

    const response = await handler()(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Email delivery failed." });
    expect(state.reportError).toHaveBeenCalledWith(
      "Club email database operation failed.",
    );
  });
});
