const defaultRedirect = "/app";

export function safeAppRedirect(
  value: unknown,
  origin = browserOrigin(),
): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return defaultRedirect;
  }

  if (value.startsWith("//") || hasControlCharacter(value)) {
    return defaultRedirect;
  }

  let decodedValue: string;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    return defaultRedirect;
  }

  if (
    decodedValue.startsWith("//") ||
    hasControlCharacter(decodedValue) ||
    decodedValue.includes("\\") ||
    value.includes("\\")
  ) {
    return defaultRedirect;
  }

  try {
    const baseUrl = new URL(origin);
    const redirectUrl = new URL(value, baseUrl);

    if (redirectUrl.origin !== baseUrl.origin) {
      return defaultRedirect;
    }

    const decodedPath = decodeURIComponent(redirectUrl.pathname);
    if (!isAllowedPath(decodedPath) || decodedPath.includes("\\")) {
      return defaultRedirect;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return defaultRedirect;
  }
}

function isAllowedPath(pathname: string) {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    /^\/invites\/[^/]+$/.test(pathname)
  );
}

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function browserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}
