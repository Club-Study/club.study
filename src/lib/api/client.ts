export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string>;
};

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error("Missing VITE_API_URL.");
}

const apiBaseUrl = withTrailingSlash(apiUrl);
let csrfPromise: Promise<void> | null = null;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const url = new URL(stripLeadingSlash(path), apiBaseUrl);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    await ensureCsrfToken(headers);
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(errorMessage(data), response.status, data);
  }

  return data as T;
}

async function ensureCsrfToken(headers: Headers) {
  const existingToken = getCookie("csrftoken");

  if (existingToken) {
    headers.set("X-CSRFToken", existingToken);
    return;
  }

  csrfPromise ??= fetch(new URL("api/csrf/", apiBaseUrl), {
    credentials: "include",
  }).then(async (response) => {
    if (!response.ok) {
      const data = await parseResponse(response);
      throw new ApiError(errorMessage(data), response.status, data);
    }
  });

  await csrfPromise;
  const token = getCookie("csrftoken");

  if (!token) {
    throw new Error("Django did not set a CSRF cookie.");
  }

  headers.set("X-CSRFToken", token);
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("API returned invalid JSON.", response.status, text);
  }
}

function errorMessage(data: unknown) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (isObject(data)) {
    if (typeof data.detail === "string") {
      return data.detail;
    }

    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
      return firstValue[0];
    }

    if (typeof firstValue === "string") {
      return firstValue;
    }
  }

  return "API request failed.";
}

function getCookie(name: string) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function stripLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
