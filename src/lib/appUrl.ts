const canonicalProductionOrigin = "https://cosearch.club";

type AppBaseUrlOptions = {
  isProduction: boolean;
  configuredUrl?: string;
  currentOrigin?: string;
};

export function resolveAppBaseUrl({
  isProduction,
  configuredUrl,
  currentOrigin,
}: AppBaseUrlOptions) {
  const candidate = isProduction
    ? canonicalProductionOrigin
    : configuredUrl || currentOrigin;

  if (!candidate) {
    throw new Error("Missing VITE_APP_URL outside the browser.");
  }

  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("VITE_APP_URL must use http or https.");
  }

  return `${url.origin}/`;
}

const appBaseUrl = resolveAppBaseUrl({
  isProduction: import.meta.env.PROD,
  configuredUrl: import.meta.env.VITE_APP_URL,
  currentOrigin:
    typeof window === "undefined" ? undefined : window.location.origin,
});

export function buildAppUrl(path: string) {
  return new URL(path.replace(/^\/+/, ""), appBaseUrl).toString();
}

export function buildAuthCallbackUrl(redirect: string) {
  const callbackUrl = new URL("auth/callback", appBaseUrl);
  callbackUrl.searchParams.set("redirect", redirect);
  return callbackUrl.toString();
}
