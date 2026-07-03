import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = join(rootDir, "dist");
const swPath = join(distDir, "sw.js");
const manifestPath = join(distDir, "manifest.webmanifest");

function fail(message) {
  console.error(`PWA cache verification failed: ${message}`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = join(dir, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

if (!existsSync(distDir)) {
  fail("dist/ is missing. Run npm run build before npm run test:pwa.");
}

if (!existsSync(swPath)) {
  fail("dist/sw.js is missing.");
}

if (!existsSync(manifestPath)) {
  fail("dist/manifest.webmanifest is missing.");
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.name !== "club.study" || manifest.short_name !== "club.study") {
  fail("manifest app name must be club.study.");
}

if (manifest.start_url !== "/app") {
  fail("manifest start_url must be /app.");
}

const serviceWorker = readFileSync(swPath, "utf8");
const forbiddenRuntimeCachePatterns = [
  /new\s+(NetworkFirst|CacheFirst|StaleWhileRevalidate|CacheOnly|NetworkOnly)\s*\(/,
  /arxiv\.org/i,
  /supabase/i,
  /functions\/v1/i,
  /rest\/v1/i,
  /auth\/v1/i,
  /storage\/v1/i,
  /\.pdf\b/i,
];

for (const pattern of forbiddenRuntimeCachePatterns) {
  if (pattern.test(serviceWorker)) {
    fail(`service worker contains forbidden cache/runtime pattern ${pattern}.`);
  }
}

const precachedUrls = [...serviceWorker.matchAll(/url:"([^"]+)"/g)].map(
  (match) => match[1],
);
const allowedPrecachePattern =
  /^(?:index\.html|favicon\.svg|manifest\.webmanifest|registerSW\.js|assets\/[^?#]+\.(?:js|css|svg|ico|png|webmanifest))$/;

if (precachedUrls.length === 0) {
  fail("service worker does not list any precached assets.");
}

for (const url of precachedUrls) {
  if (!allowedPrecachePattern.test(url)) {
    fail(`unexpected precached URL: ${url}`);
  }
}

const distFiles = walk(distDir).map((file) => relative(distDir, file));
const cachedPdf = distFiles.find((file) => file.toLowerCase().endsWith(".pdf"));

if (cachedPdf) {
  fail(`PDF file was emitted into dist/: ${cachedPdf}`);
}

console.log(
  `PWA cache verification passed: ${precachedUrls.length} static app assets precached, no runtime API/PDF caching.`,
);
