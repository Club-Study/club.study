import { SafeUserError } from "@/lib/user-facing-error";

export const MAX_HTTP_URL_LENGTH = 2048;

export function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new SafeUserError("Enter a valid HTTP or HTTPS URL.");
  }

  if (trimmed.length > MAX_HTTP_URL_LENGTH) {
    throw new SafeUserError("URL is too long.");
  }

  if (hasControlCharacter(trimmed)) {
    throw new SafeUserError("Enter a valid HTTP or HTTPS URL.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SafeUserError("Enter a valid HTTP or HTTPS URL.");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new SafeUserError("Enter a valid HTTP or HTTPS URL.");
  }

  url.hash = "";
  return url.toString();
}

export function normalizeEmbeddablePdfUrl(value: string) {
  const normalized = normalizeHttpUrl(value);
  const url = new URL(normalized);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "arxiv.org" ||
    url.port !== "" ||
    !url.pathname.startsWith("/pdf/")
  ) {
    throw new SafeUserError(
      "Only canonical arXiv PDFs can be embedded safely. Open this link in a separate browser tab instead.",
    );
  }

  return normalized;
}

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}
