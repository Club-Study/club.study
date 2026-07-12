export type ClubEmailNotificationKind =
  | "scheduled"
  | "reminder_3d"
  | "reminder_1d";

export type ClubEmailNotification = {
  notificationId: string;
  notificationKind: ClubEmailNotificationKind;
  recipientEmail: string;
  recipientName: string;
  clubId: string;
  clubName: string;
  scheduleId: string;
  paperTitle: string;
  deadline: string | null;
  attemptCount: number;
};

export type RenderedClubEmail = {
  subject: string;
  text: string;
  html: string;
};

export type ClubEmailSendResult =
  | { outcome: "sent"; providerMessageId: string }
  | { outcome: "retry"; error: string }
  | { outcome: "failed"; error: string };

export type ClubEmailSender = (
  notification: ClubEmailNotification,
) => Promise<ClubEmailSendResult>;

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const defaultResendApiUrl = "https://api.resend.com/emails";
const defaultTimeoutMs = 8_000;

export function renderClubEmail(
  notification: ClubEmailNotification,
  applicationUrl: string,
): RenderedClubEmail {
  const paperUrl = scheduledPaperUrl(applicationUrl, notification.scheduleId);
  const deadline = notification.deadline
    ? formatDeadline(notification.deadline)
    : null;
  const heading = notificationHeading(notification.notificationKind);
  const subject = safeSubject(
    notificationSubject(notification.notificationKind, notification.paperTitle),
  );
  const greetingName = notification.recipientName.trim() || "there";
  const timing = deadline
    ? `The scheduled date is ${deadline}.`
    : "No scheduled date is currently set.";
  const text = [
    `Hi ${greetingName},`,
    "",
    heading,
    `${notification.paperTitle} — ${notification.clubName}`,
    timing,
    "",
    `Open the paper: ${paperUrl}`,
    "",
    `You receive this because you enabled email updates for ${notification.clubName}.`,
    "Turn them off from the club page at any time.",
  ].join("\n");

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:28px">
        <p style="margin:0 0 24px">Hi ${escapeHtml(greetingName)},</p>
        <p style="margin:0 0 8px;color:#52525b">${escapeHtml(heading)}</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35">${escapeHtml(notification.paperTitle)}</h1>
        <p style="margin:0 0 8px;color:#52525b">${escapeHtml(notification.clubName)}</p>
        <p style="margin:0 0 24px;color:#52525b">${escapeHtml(timing)}</p>
        <a href="${escapeHtml(paperUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;padding:11px 16px">Open paper</a>
        <p style="margin:28px 0 0;color:#71717a;font-size:12px;line-height:1.5">You receive this because you enabled email updates for ${escapeHtml(notification.clubName)}. Turn them off from the club page at any time.</p>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function createResendClubEmailSender({
  apiKey,
  from,
  applicationUrl,
  apiUrl = defaultResendApiUrl,
  timeoutMs = defaultTimeoutMs,
  fetchImplementation = fetch,
}: {
  apiKey: string;
  from: string;
  applicationUrl: string;
  apiUrl?: string;
  timeoutMs?: number;
  fetchImplementation?: FetchImplementation;
}): ClubEmailSender {
  if (!apiKey.trim()) {
    throw new Error("A Resend API key is required.");
  }
  if (!from.trim() || /[\r\n]/.test(from)) {
    throw new Error("A valid sender is required.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new Error("The email timeout must be between 1 and 30 seconds.");
  }

  const endpoint = requiredHttpUrl(apiUrl);
  const canonicalApplicationUrl = requiredHttpUrl(applicationUrl);

  return async (notification) => {
    const rendered = renderClubEmail(notification, canonicalApplicationUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `club-email-notification-${notification.notificationId}`,
        },
        body: JSON.stringify({
          from,
          to: [notification.recipientEmail],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const providerMessageId = await resendMessageId(response);
        return providerMessageId
          ? { outcome: "sent", providerMessageId }
          : {
              outcome: "retry",
              error: "Resend returned no message identifier.",
            };
      }

      const error = `Resend returned HTTP ${response.status}.`;
      await response.body?.cancel().catch(() => undefined);
      return isRetryableStatus(response.status)
        ? { outcome: "retry", error }
        : { outcome: "failed", error };
    } catch {
      return {
        outcome: "retry",
        error: "Resend could not be reached before the delivery timeout.",
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

function notificationHeading(kind: ClubEmailNotificationKind) {
  if (kind === "scheduled") {
    return "A new paper was scheduled";
  }
  if (kind === "reminder_3d") {
    return "Reading reminder: 3 days remaining";
  }
  return "Reading reminder: due tomorrow";
}

function notificationSubject(
  kind: ClubEmailNotificationKind,
  paperTitle: string,
) {
  if (kind === "scheduled") {
    return `New club paper: ${paperTitle}`;
  }
  if (kind === "reminder_3d") {
    return `Due in 3 days: ${paperTitle}`;
  }
  return `Due tomorrow: ${paperTitle}`;
}

function safeSubject(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 160);
}

function scheduledPaperUrl(applicationUrl: string, scheduleId: string) {
  const url = new URL(applicationUrl);
  url.pathname = `/app/papers/${encodeURIComponent(scheduleId)}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function formatDeadline(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Notification deadline is invalid.");
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Notification deadline is invalid.");
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(date);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function requiredHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("Email URLs must use HTTPS outside local development.");
  }
  return url.toString();
}

function isRetryableStatus(status: number) {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

async function resendMessageId(response: Response) {
  try {
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("id" in data)) {
      return null;
    }
    const id = (data as { id?: unknown }).id;
    return typeof id === "string" && id.trim()
      ? id.trim().slice(0, 256)
      : null;
  } catch {
    return null;
  }
}
