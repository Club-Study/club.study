import { createClient } from "npm:@supabase/supabase-js@2.110.0";

const localOrigins = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
] as const;
const allowedOrigins = new Set([
  ...localOrigins,
  ...parseConfiguredOrigins(Deno.env.get("ALLOWED_ORIGINS")),
]);
const maxBodyBytes = 4_096;
const maxInputLength = 256;
const maxNotesLength = 2_000;
const maxArxivResponseBytes = 1_000_000;
const upstreamTimeoutMs = 8_000;
const supabaseRequestTimeoutMs = 5_000;
const requestBodyTimeoutMs = 5_000;

type ArxivMetadata = {
  title: string;
  authors: string[];
  abstract: string | null;
  arxiv_id: string;
  doi: string | null;
  license: string | null;
  abstract_url: string;
  pdf_url: string;
  published_at: string | null;
  updated_at: string | null;
};

type RequestBody = Record<string, unknown>;

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const corsHeaders = corsHeadersFor(origin);

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: "Origin not allowed." }, 403, corsHeaders);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, corsHeaders);
  }

  try {
    const userId = await requireAuthenticatedUser(request);
    const body = await readRequestBody(request);
    const action = requiredAction(body.action);
    const input = requiredInput(body.input);
    const scheduleParams =
      action === "schedule"
        ? {
            clubId: requiredUuid(body.clubId, "clubId"),
            weekStart: optionalDate(body.deadline, "deadline"),
            notes: optionalText(body.notes, "notes", maxNotesLength),
          }
        : null;
    const personalDeadline =
      action === "personal" ? optionalDate(body.deadline, "deadline") : null;
    const serviceClient = createServiceClient();

    await consumeArxivRateLimit(serviceClient, userId);
    const metadata = await fetchArxivMetadata(input);

    if (action === "lookup") {
      return json(metadata, 200, corsHeaders);
    }

    if (action === "schedule") {
      if (!scheduleParams) {
        throw new Error("Missing validated schedule parameters.");
      }

      const { data, error } = await serviceClient.rpc("import_arxiv_schedule", {
        p_user_id: userId,
        p_club_id: scheduleParams.clubId,
        p_week_start: scheduleParams.weekStart,
        p_arxiv_metadata: metadata,
        p_notes: scheduleParams.notes,
      });

      if (error) {
        console.error("import_arxiv_schedule failed", {
          code: error.code,
          message: error.message,
        });
        throw importRequestError(error, "schedule");
      }

      return json(
        { schedule_id: resultId(data, ["id", "schedule_id"]) },
        201,
        corsHeaders,
      );
    }

    const { data, error } = await serviceClient.rpc("import_arxiv_personal", {
      p_user_id: userId,
      p_arxiv_metadata: metadata,
      p_deadline: personalDeadline,
    });

    if (error) {
      console.error("import_arxiv_personal failed", {
        code: error.code,
        message: error.message,
      });
      throw importRequestError(error, "personal");
    }

    return json(
      { personal_paper_id: resultId(data, ["id", "personal_paper_id"]) },
      201,
      corsHeaders,
    );
  } catch (error) {
    const requestError = toRequestError(error);

    if (requestError.status >= 500 && !(error instanceof RequestError)) {
      console.error("Unexpected arXiv import error", error);
    }

    return json(
      { error: requestError.message },
      requestError.status,
      corsHeaders,
    );
  }
});

async function requireAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = bearerToken(authorization);
  const authClient = createClient(
    requiredEnvironment("SUPABASE_URL"),
    defaultApiKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout },
    },
  );
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    throw new RequestError(401, "Sign in required.");
  }

  return user.id;
}

function createServiceClient() {
  return createClient(
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
}

async function consumeArxivRateLimit(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  const { data, error } = await serviceClient.rpc("consume_arxiv_rate_limit", {
    p_user_id: userId,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || message.includes("too many")) {
      throw new RequestError(
        429,
        "Too many arXiv requests. Try again in a few minutes.",
      );
    }

    console.error("consume_arxiv_rate_limit failed", {
      code: error.code,
      message: error.message,
    });
    throw new RequestError(500, "Could not verify the arXiv request limit.");
  }

  const result = Array.isArray(data) ? data[0] : data;
  const denied =
    result === false ||
    (result !== null &&
      typeof result === "object" &&
      "allowed" in result &&
      result.allowed === false);
  const allowed =
    result === true ||
    (result !== null &&
      typeof result === "object" &&
      "allowed" in result &&
      result.allowed === true);

  if (denied) {
    throw new RequestError(
      429,
      "Too many arXiv requests. Try again in a few minutes.",
    );
  }

  if (!allowed) {
    throw new RequestError(500, "Could not verify the arXiv request limit.");
  }
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

  if (sourceSignal?.aborted) {
    forwardAbort();
  } else {
    sourceSignal?.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }
}

async function readRequestBody(request: Request): Promise<RequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new RequestError(415, "Content-Type must be application/json.");
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new RequestError(413, "Request body is too large.");
  }

  const raw = await readTextWithLimit(
    request.body,
    maxBodyBytes,
    "Request body is too large.",
    requestBodyTimeoutMs,
  );
  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    throw new RequestError(400, "Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RequestError(400, "Request body must be a JSON object.");
  }

  return body as RequestBody;
}

async function fetchArxivMetadata(input: string): Promise<ArxivMetadata> {
  const normalized = normalizeArxivInput(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);

  try {
    const response = await fetch(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(
        normalized.arxivId,
      )}`,
      {
        headers: {
          accept: "application/atom+xml",
          "user-agent": "club.study/1.0 (arXiv metadata import)",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new RequestError(
        502,
        `arXiv lookup failed with ${response.status}.`,
      );
    }

    const xml = await readTextWithLimit(
      response.body,
      maxArxivResponseBytes,
      "arXiv returned an unexpectedly large response.",
    );
    const entry = firstTag(xml, "entry");

    if (!entry) {
      throw new RequestError(404, "No arXiv paper found for that ID.");
    }

    const title = firstText(entry, "title");
    const abstract = firstText(entry, "summary");
    const authors = allTags(entry, "author")
      .map((author) => firstText(author, "name"))
      .filter(Boolean);
    const entryId = firstText(entry, "id");
    const canonical = normalizeArxivInput(entryId || normalized.arxivId);

    if (canonical.arxivId !== normalized.arxivId) {
      throw new RequestError(502, "arXiv returned a different paper.");
    }

    if (!title) {
      throw new RequestError(502, "arXiv returned a paper without a title.");
    }

    return {
      title,
      authors,
      abstract: abstract || null,
      arxiv_id: canonical.arxivId,
      doi: firstText(entry, "arxiv:doi") || firstText(entry, "doi") || null,
      license:
        firstText(entry, "arxiv:license") || firstText(entry, "license") ||
        null,
      abstract_url: canonical.abstractUrl,
      pdf_url: canonical.pdfUrl,
      published_at: firstText(entry, "published") || null,
      updated_at: firstText(entry, "updated") || null,
    };
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RequestError(504, "arXiv lookup timed out.");
    }

    throw new RequestError(502, "Could not reach or read arXiv.");
  } finally {
    clearTimeout(timeout);
  }
}

async function readTextWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  tooLargeMessage: string,
  timeoutMs?: number,
) {
  if (!stream) {
    throw new RequestError(400, "Request body is required.");
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  const deadline = timeoutMs ? Date.now() + timeoutMs : null;

  try {
    while (true) {
      const { done, value } = await readChunk(reader, deadline);
      if (done) {
        break;
      }

      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RequestError(413, tooLargeMessage);
      }

      result += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  return result + decoder.decode();
}

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadline: number | null,
) {
  if (deadline === null) {
    return reader.read();
  }

  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new RequestError(408, "Request body took too long.");
  }

  let timeout: number | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new RequestError(408, "Request body took too long.")),
          remainingMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function json(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function corsHeadersFor(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function parseConfiguredOrigins(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .flatMap((origin) => {
      try {
        const url = new URL(origin);
        if (
          (url.protocol !== "http:" && url.protocol !== "https:") ||
          !url.hostname
        ) {
          return [];
        }

        return [url.origin];
      } catch {
        return [];
      }
    });
}

function bearerToken(authorization: string | null) {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!match?.[1] || match[1].length > 8_192) {
    throw new RequestError(401, "Sign in required.");
  }

  return match[1];
}

function requiredAction(value: unknown): "lookup" | "schedule" | "personal" {
  if (value === undefined) {
    return "lookup";
  }

  if (value === "lookup" || value === "schedule" || value === "personal") {
    return value;
  }

  throw new RequestError(400, "Unknown arXiv action.");
}

function requiredInput(value: unknown) {
  if (typeof value !== "string" || value.length > maxInputLength) {
    throw new RequestError(400, "Use a valid arXiv URL or ID.");
  }

  return value;
}

function requiredUuid(value: unknown, label: string) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new RequestError(400, `${label} must be a UUID.`);
  }

  return value;
}

function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestError(400, `${label} must be a valid date.`);
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new RequestError(400, `${label} must be a valid date.`);
  }

  return value;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.length > maxLength) {
    throw new RequestError(400, `${label} is too long.`);
  }

  return value.trim() || null;
}

function resultId(data: unknown, keys: string[]) {
  const value = Array.isArray(data) ? data[0] : data;

  if (typeof value === "string") {
    return requiredUuid(value, "result id");
  }

  if (value && typeof value === "object") {
    for (const key of keys) {
      const id = (value as Record<string, unknown>)[key];
      if (typeof id === "string") {
        return requiredUuid(id, "result id");
      }
    }
  }

  throw new Error("Import RPC returned no identifier.");
}

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
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

function importRequestError(
  error: { code?: string; message?: string },
  target: "schedule" | "personal",
) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (target === "schedule" && message.includes("not a member")) {
    return new RequestError(403, "You are no longer a member of this club.");
  }

  if (target === "personal" && message.includes("profile not found")) {
    return new RequestError(404, "Your profile could not be found.");
  }

  if (code === "23505") {
    return new RequestError(409, "That paper already exists.");
  }

  if (message.includes("notes must be")) {
    return new RequestError(400, "The notes are too long.");
  }

  if (["22001", "22007", "22P02", "23502", "23503", "23514"].includes(code)) {
    return new RequestError(502, "arXiv returned invalid paper metadata.");
  }

  return new RequestError(
    500,
    target === "schedule"
      ? "Could not schedule the arXiv paper."
      : "Could not add the arXiv paper.",
  );
}

function firstText(xml: string, tagName: string) {
  return compactText(decodeXml(stripTags(firstTag(xml, tagName) ?? "")));
}

function firstTag(xml: string, tagName: string) {
  return tagPattern(tagName).exec(xml)?.[1] ?? null;
}

function allTags(xml: string, tagName: string) {
  return [...xml.matchAll(tagPattern(tagName, "gi"))]
    .map((match) => match[1] ?? "")
    .filter(Boolean);
}

function tagPattern(tagName: string, flags = "i") {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
    flags,
  );
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

type NormalizedArxivInput = {
  arxivId: string;
  abstractUrl: string;
  pdfUrl: string;
};

const canonicalIdPattern =
  /^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+\/[0-9]{7})(?:v[0-9]+)?$/;

function normalizeArxivInput(input: string): NormalizedArxivInput {
  const raw = input.trim();
  if (!raw) {
    throw new RequestError(400, "Enter an arXiv URL or ID.");
  }

  const extracted = extractArxivId(raw);
  const match = canonicalIdPattern.exec(extracted);

  if (!match?.[1]) {
    throw new RequestError(400, "Use a valid arXiv URL, PDF URL, or ID.");
  }

  const arxivId = match[1];

  return {
    arxivId,
    abstractUrl: `https://arxiv.org/abs/${arxivId}`,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
  };
}

function extractArxivId(input: string) {
  try {
    const url = new URL(input);
    if (!["arxiv.org", "www.arxiv.org"].includes(url.hostname)) {
      return input;
    }

    const [kind, ...rest] = url.pathname.split("/").filter(Boolean);
    if ((kind === "abs" || kind === "pdf") && rest.length > 0) {
      return rest.join("/").replace(/\.pdf$/i, "");
    }
  } catch {
    return input.replace(/^arXiv:/i, "");
  }

  return input;
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

function toRequestError(error: unknown) {
  if (error instanceof RequestError) {
    return error;
  }

  return new RequestError(500, "arXiv import failed.");
}
