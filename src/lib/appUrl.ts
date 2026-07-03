const appUrl = import.meta.env.VITE_APP_URL;

if (!appUrl) {
  throw new Error("Missing VITE_APP_URL.");
}

const appBaseUrl = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;

export function buildAppUrl(path: string) {
  return new URL(path.replace(/^\/+/, ""), appBaseUrl).toString();
}
