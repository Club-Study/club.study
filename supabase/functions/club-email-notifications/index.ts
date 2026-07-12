import { createClient } from "npm:@supabase/supabase-js@2.110.0";

import { createResendClubEmailSender } from "./email.ts";
import {
  createClubEmailNotificationHandler,
  type ClaimedClubEmailNotification,
  type ClubEmailNotificationResolution,
  type ClubEmailNotificationStore,
} from "./handler.ts";

const supabaseRequestTimeoutMs = 8_000;

const supabase = createClient(
  requiredEnvironment("SUPABASE_URL"),
  defaultApiKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { fetch: fetchWithTimeout },
  },
);

const store: ClubEmailNotificationStore = {
  async queueDue(now) {
    const { data, error } = await supabase.rpc("queue_due_club_email_reminders", {
      p_now: now,
    });
    if (error || typeof data !== "number") {
      throw new Error("Could not queue club email reminders.");
    }
    return data;
  },

  async claim(limit, now) {
    const { data, error } = await supabase.rpc("claim_club_email_notifications", {
      p_limit: limit,
      p_now: now,
    });
    if (error || !Array.isArray(data)) {
      throw new Error("Could not claim club email notifications.");
    }
    return data as ClaimedClubEmailNotification[];
  },

  async resolve(resolution) {
    const { data, error } = await supabase.rpc(
      "resolve_club_email_notification",
      resolutionArguments(resolution),
    );
    if (error || typeof data !== "boolean") {
      throw new Error("Could not resolve a club email notification.");
    }
    return data;
  },
};

const handler = createClubEmailNotificationHandler({
  cronSecret: requiredEnvironment("CLUB_EMAIL_CRON_SECRET"),
  store,
  sender: createResendClubEmailSender({
    apiKey: requiredEnvironment("RESEND_API_KEY"),
    from: requiredEnvironment("CLUB_EMAIL_FROM"),
    applicationUrl: requiredEnvironment("CLUB_EMAIL_APP_URL"),
    apiUrl: Deno.env.get("RESEND_API_URL") || undefined,
  }),
  reportError: (message) => console.error(message),
});

Deno.serve(handler);

function resolutionArguments(resolution: ClubEmailNotificationResolution) {
  return {
    p_notification_id: resolution.notificationId,
    p_outcome: resolution.outcome,
    p_provider_message_id: resolution.providerMessageId,
    p_error: resolution.error,
    p_retry_at: resolution.retryAt,
    p_now: resolution.now,
  };
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing server environment variable ${name}.`);
  }
  return value;
}

function defaultApiKey(mapName: string, legacyName: string) {
  const serializedKeys = Deno.env.get(mapName);
  if (!serializedKeys) {
    return requiredEnvironment(legacyName);
  }

  let keys: unknown;
  try {
    keys = JSON.parse(serializedKeys);
  } catch {
    throw new Error(`Invalid server environment variable ${mapName}.`);
  }

  const defaultKey =
    keys !== null && typeof keys === "object"
      ? (keys as Record<string, unknown>).default
      : null;
  if (typeof defaultKey !== "string" || !defaultKey) {
    throw new Error(`Missing default API key in ${mapName}.`);
  }
  return defaultKey;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const sourceSignal = init.signal;
  const forwardAbort = () => controller.abort(sourceSignal?.reason);
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timed out", "TimeoutError")),
    supabaseRequestTimeoutMs,
  );

  if (sourceSignal) {
    if (sourceSignal.aborted) {
      forwardAbort();
    } else {
      sourceSignal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }
}
