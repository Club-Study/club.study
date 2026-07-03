import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Database } from "../../src/lib/supabase/database.types";

loadEnvFile(".env.local");
loadEnvFile(".env.test.local");

const supabaseUrl = requiredEnv("VITE_SUPABASE_URL");
const publishableKey = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const publicClient = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const usersToDelete: string[] = [];

test.afterAll(async () => {
  await Promise.all(
    usersToDelete.map((userId) => admin.auth.admin.deleteUser(userId)),
  );
});

test("sign-in shell renders", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByText("club.study")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("authenticated launch loop works", async ({ browser, page }) => {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await createSignedInUser(page, `owner-${testId}`);
  const clubName = `Launch Club ${testId}`;

  await page.goto("/app");
  await expect(page.getByText("Current week")).toBeVisible();
  await page.getByRole("link", { name: "New club" }).click();
  await page.getByLabel("Name").fill(clubName);
  await expect(page.getByLabel("Slug")).toHaveValue(
    slugFromName(clubName),
  );
  await page.getByRole("button", { name: "Create club" }).click();

  await expect(page.getByRole("heading", { name: clubName })).toBeVisible();
  const clubId = getClubIdFromUrl(page.url());

  await page.getByRole("link", { name: "Members" }).click();
  await page.getByRole("button", { name: "Create invite" }).click();
  const inviteInput = page.locator("input[readonly]").first();
  await expect(inviteInput).toHaveValue(/\/invites\//);
  const inviteUrl = await inviteInput.inputValue();

  const memberPage = await signedInPage(browser, `member-${testId}`);
  await memberPage.goto(inviteUrl);
  await expect(memberPage).toHaveURL(
    new RegExp(`/app/clubs/${clubId}/schedule$`),
  );
  await expect(
    memberPage.getByRole("heading", { name: clubName }),
  ).toBeVisible();
  await memberPage.context().close();

  await page.getByRole("link", { name: "Schedule" }).click();
  await mockArxivLookup(page);
  await page.getByRole("button", { name: "Schedule paper" }).click();
  await page.getByLabel("arXiv URL or ID").fill("2401.12345");
  await page.getByRole("button", { name: "Lookup" }).click();
  await expect(page.getByText("Efficient Reading Clubs")).toBeVisible();
  await page.getByRole("button", { name: "Schedule" }).click();

  const paperLink = page.getByRole("link", {
    name: "Efficient Reading Clubs",
  });
  await expect(paperLink).toBeVisible();
  await paperLink.click();

  await expect(
    page.getByRole("link", { name: "Open on arXiv" }),
  ).toHaveAttribute("href", "https://arxiv.org/abs/2401.12345");
  await expect(page.getByRole("link", { name: "Open PDF" })).toHaveAttribute(
    "href",
    "https://arxiv.org/pdf/2401.12345",
  );

  await page.getByRole("button", { name: "Mark read" }).click();
  await expect(page.getByRole("button", { name: "Mark unread" })).toBeVisible();

  await page.getByPlaceholder("Add a comment").fill("Ready for discussion.");
  await page.getByRole("button", { name: "Comment" }).click();
  await expect(page.getByText("Ready for discussion.")).toBeVisible();
});

async function signedInPage(browser: Browser, prefix: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await createSignedInUser(page, prefix);

  return page;
}

async function createSignedInUser(page: Page, prefix: string) {
  const password = `Testing-${Date.now()}-${Math.random().toString(36).slice(2)}!`;
  const email = `${prefix}@club-study.test`;
  const displayName = prefix.replace(/-/g, " ");
  const {
    data: { user },
    error: createError,
  } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !user) {
    throw createError ?? new Error("Test user was not created.");
  }

  usersToDelete.push(user.id);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    avatar_url: null,
    bio: null,
  });

  if (profileError) {
    throw profileError;
  }

  const {
    data: { session },
    error: signInError,
  } = await publicClient.auth.signInWithPassword({ email, password });

  if (signInError || !session) {
    throw signInError ?? new Error("Test session was not created.");
  }

  await installSession(page, session);

  return { userId: user.id, email };
}

async function installSession(page: Page, session: Session) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(session) },
  );
}

async function mockArxivLookup(page: Page) {
  await page.route("**/functions/v1/arxiv-lookup", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        title: "Efficient Reading Clubs",
        authors: ["Ada Lovelace", "Alan Turing"],
        abstract: "A compact test paper for reading group workflows.",
        arxiv_id: "2401.12345",
        doi: null,
        license: "http://arxiv.org/licenses/nonexclusive-distrib/1.0/",
        abstract_url: "https://arxiv.org/abs/2401.12345",
        pdf_url: "https://arxiv.org/pdf/2401.12345",
        published_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      }),
    });
  });
}

function getClubIdFromUrl(url: string) {
  const match = /\/app\/clubs\/([^/]+)\/schedule/.exec(url);

  if (!match?.[1]) {
    throw new Error(`Could not find club id in URL: ${url}`);
  }

  return match[1];
}

function slugFromName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadEnvFile(fileName: string) {
  const filePath = join(process.cwd(), fileName);

  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());

    if (match?.[1] && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2] ?? "";
    }
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
