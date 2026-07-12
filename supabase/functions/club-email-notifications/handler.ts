import type {
  ClubEmailNotification,
  ClubEmailNotificationKind,
  ClubEmailSender,
} from "./email.ts";

export type ClaimedClubEmailNotification = {
  notification_id: string;
  notification_kind: ClubEmailNotificationKind;
  recipient_email: string | null;
  recipient_name: string;
  club_id: string;
  club_name: string;
  schedule_id: string;
  paper_title: string;
  deadline: string | null;
  attempt_count: number;
};

export type ClubEmailNotificationResolution = {
  notificationId: string;
  outcome: "sent" | "retry" | "failed" | "cancelled";
  providerMessageId?: string;
  error?: string;
  retryAt?: string;
  now: string;
};

export type ClubEmailNotificationStore = {
  queueDue(now: string): Promise<number>;
  claim(limit: number, now: string): Promise<ClaimedClubEmailNotification[]>;
  resolve(resolution: ClubEmailNotificationResolution): Promise<boolean>;
};

type DeliveryOutcome =
  | "sent"
  | "retried"
  | "failed"
  | "cancelled"
  | "resolutionFailed";

const defaultBatchLimit = 25;
const defaultConcurrency = 5;

export function createClubEmailNotificationHandler({
  cronSecret,
  store,
  sender,
  now = () => new Date(),
  batchLimit = defaultBatchLimit,
  concurrency = defaultConcurrency,
  reportError = () => undefined,
}: {
  cronSecret: string;
  store: ClubEmailNotificationStore;
  sender: ClubEmailSender;
  now?: () => Date;
  batchLimit?: number;
  concurrency?: number;
  reportError?: (message: string) => void;
}) {
  if (cronSecret.length < 32) {
    throw new Error("The club email cron secret must be at least 32 characters.");
  }
  if (!Number.isInteger(batchLimit) || batchLimit < 1 || batchLimit > 50) {
    throw new Error("The notification batch limit must be between 1 and 50.");
  }
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error("Notification concurrency must be between 1 and 10.");
  }

  return async (request: Request) => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    }

    const suppliedSecret = request.headers.get("x-cron-secret") ?? "";
    if (!constantTimeEqual(suppliedSecret, cronSecret)) {
      return json({ error: "Unauthorized." }, 401);
    }

    const invocationTime = now();
    if (Number.isNaN(invocationTime.getTime())) {
      reportError("Club email invocation time was invalid.");
      return json({ error: "Email delivery failed." }, 500);
    }
    const nowIso = invocationTime.toISOString();

    try {
      const queued = await store.queueDue(nowIso);
      const claimed = await store.claim(batchLimit, nowIso);
      const outcomes = await mapWithConcurrency(
        claimed,
        concurrency,
        (notification) =>
          deliverNotification(notification, nowIso, store, sender),
      );

      return json({
        queued,
        claimed: claimed.length,
        sent: countOutcome(outcomes, "sent"),
        retried: countOutcome(outcomes, "retried"),
        failed: countOutcome(outcomes, "failed"),
        cancelled: countOutcome(outcomes, "cancelled"),
        resolutionFailed: countOutcome(outcomes, "resolutionFailed"),
      });
    } catch {
      reportError("Club email database operation failed.");
      return json({ error: "Email delivery failed." }, 500);
    }
  };
}

async function deliverNotification(
  claim: ClaimedClubEmailNotification,
  nowIso: string,
  store: ClubEmailNotificationStore,
  sender: ClubEmailSender,
): Promise<DeliveryOutcome> {
  if (!claim.recipient_email) {
    return resolveOutcome(store, {
      notificationId: claim.notification_id,
      outcome: "cancelled",
      now: nowIso,
    }, "cancelled");
  }

  let notification: ClubEmailNotification;
  try {
    notification = normalizeClaim(claim);
  } catch {
    return resolveOutcome(store, {
      notificationId: claim.notification_id,
      outcome: "failed",
      error: "Claimed notification data was invalid.",
      now: nowIso,
    }, "failed");
  }
  let sendResult;
  try {
    sendResult = await sender(notification);
  } catch {
    sendResult = {
      outcome: "retry" as const,
      error: "The email provider request failed unexpectedly.",
    };
  }

  if (sendResult.outcome === "sent") {
    return resolveOutcome(store, {
      notificationId: notification.notificationId,
      outcome: "sent",
      providerMessageId: sendResult.providerMessageId,
      now: nowIso,
    }, "sent");
  }

  if (sendResult.outcome === "retry" && notification.attemptCount < 5) {
    return resolveOutcome(store, {
      notificationId: notification.notificationId,
      outcome: "retry",
      error: sendResult.error,
      retryAt: retryTime(nowIso, notification.attemptCount),
      now: nowIso,
    }, "retried");
  }

  return resolveOutcome(store, {
    notificationId: notification.notificationId,
    outcome: "failed",
    error: sendResult.error,
    now: nowIso,
  }, "failed");
}

async function resolveOutcome(
  store: ClubEmailNotificationStore,
  resolution: ClubEmailNotificationResolution,
  outcome: Exclude<DeliveryOutcome, "resolutionFailed">,
): Promise<DeliveryOutcome> {
  try {
    return (await store.resolve(resolution)) ? outcome : "resolutionFailed";
  } catch {
    return "resolutionFailed";
  }
}

function normalizeClaim(
  claim: ClaimedClubEmailNotification,
): ClubEmailNotification {
  const requiredStrings = [
    claim.notification_id,
    claim.recipient_email,
    claim.recipient_name,
    claim.club_id,
    claim.club_name,
    claim.schedule_id,
    claim.paper_title,
  ];
  if (requiredStrings.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("Claimed notification data is incomplete.");
  }
  if (!Number.isInteger(claim.attempt_count) || claim.attempt_count < 1) {
    throw new Error("Claimed notification attempt count is invalid.");
  }
  if (
    claim.notification_kind !== "scheduled" &&
    claim.notification_kind !== "reminder_3d" &&
    claim.notification_kind !== "reminder_1d"
  ) {
    throw new Error("Claimed notification kind is invalid.");
  }

  return {
    notificationId: claim.notification_id,
    notificationKind: claim.notification_kind,
    recipientEmail: claim.recipient_email,
    recipientName: claim.recipient_name,
    clubId: claim.club_id,
    clubName: claim.club_name,
    scheduleId: claim.schedule_id,
    paperTitle: claim.paper_title,
    deadline: claim.deadline,
    attemptCount: claim.attempt_count,
  };
}

function retryTime(nowIso: string, attemptCount: number) {
  const delayMinutes = [5, 30, 180, 720][Math.max(0, attemptCount - 1)] ?? 720;
  return new Date(new Date(nowIso).getTime() + delayMinutes * 60_000).toISOString();
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function countOutcome(outcomes: DeliveryOutcome[], expected: DeliveryOutcome) {
  return outcomes.filter((outcome) => outcome === expected).length;
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

function json(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}
