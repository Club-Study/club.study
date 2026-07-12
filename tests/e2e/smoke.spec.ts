import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type Session } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Database } from "../../src/lib/supabase/database.types";

loadEnvFile(".env.local");

const configuredSupabaseUrl = requiredEnv("VITE_SUPABASE_URL");
const configuredPublishableKey = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const localSupabase = readLocalSupabaseStatus();
const supabaseUrl = localSupabase.apiUrl;
const publishableKey = localSupabase.publishableKey;
const serviceBearer = createLocalBearer({ role: "service_role" });
assertLocalSupabaseUrl(supabaseUrl);
assertMatchingLocalConfig({
  configuredSupabaseUrl,
  configuredPublishableKey,
  localSupabase,
});
const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
const arxivFunctionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/arxiv-lookup`;

const admin = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  global: {
    headers: { Authorization: `Bearer ${serviceBearer}` },
  },
});

const usersToDelete: string[] = [];
const clubsToDelete: string[] = [];

function assertLocalSupabaseUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  ) {
    throw new Error(
      "E2E tests are destructive and may only target a local Supabase URL.",
    );
  }
}

test.afterAll(async () => {
  if (clubsToDelete.length) {
    const { error } = await admin.from("clubs").delete().in("id", clubsToDelete);
    if (error) {
      throw error;
    }
  }

  for (const userId of usersToDelete) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      throw error;
    }
  }
});

test("sign-in shell renders", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page.getByText("cosearch", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
});

test("real arXiv Edge function enforces auth, origin, and request validation", async ({
  page,
  request,
}) => {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await createSignedInUser(page, `edge-${testId}`);
  const authorizationHeaders = {
    Authorization: `Bearer ${user.accessToken}`,
    apikey: publishableKey,
  };

  const blockedOrigin = await request.post(arxivFunctionUrl, {
    headers: {
      ...authorizationHeaders,
      Origin: "https://attacker.example",
    },
    data: { action: "lookup", input: "2401.12345" },
  });

  expect(blockedOrigin.status()).toBe(403);
  await expect(blockedOrigin.json()).resolves.toEqual({
    error: "Origin not allowed.",
  });

  const invalidInput = await request.post(arxivFunctionUrl, {
    headers: {
      ...authorizationHeaders,
      Origin: "http://127.0.0.1:5173",
    },
    // The deployed v2 client omitted `action`; keep lookup backward compatible
    // so the Edge function can be rolled out before the frontend cutover.
    data: { input: "not-an-arxiv-id" },
  });

  expect(invalidInput.status()).toBe(400);
  await expect(invalidInput.json()).resolves.toEqual({
    error: "Use a valid arXiv URL, PDF URL, or ID.",
  });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.userId);
  expect(deleteError).toBeNull();
  const cleanupIndex = usersToDelete.indexOf(user.userId);
  if (cleanupIndex >= 0) {
    usersToDelete.splice(cleanupIndex, 1);
  }

  const deletedUser = await request.post(arxivFunctionUrl, {
    headers: {
      ...authorizationHeaders,
      Origin: "http://127.0.0.1:5173",
    },
    data: { action: "lookup", input: "not-an-arxiv-id" },
  });

  expect(deletedUser.status()).toBe(401);
});

test("authenticated launch loop works", async ({ browser, page }) => {
  const testId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = await createSignedInUser(page, `owner-${testId}`);
  const clubName = `Launch Club ${testId}`;

  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
  await page.getByRole("link", { name: "Clubs" }).click();
  await expect(page.getByRole("heading", { name: "Clubs" })).toBeVisible();
  await page.getByRole("link", { name: "New club" }).click();
  await page.getByLabel("Name").fill(clubName);
  await page.getByRole("button", { name: "Create club" }).click();

  await expect(page.getByRole("heading", { name: clubName })).toBeVisible();
  const clubId = getClubIdFromUrl(page.url());
  clubsToDelete.push(clubId);

  const emailUpdates = page.getByRole("switch", { name: "Email updates" });
  await expect(emailUpdates).not.toBeChecked();
  await emailUpdates.click();
  await expect(emailUpdates).toBeChecked();
  await expect(page.getByText("Email updates enabled")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Email updates" }),
  ).toBeChecked();

  const applicantPrefix = `applicant-${testId}`;
  const applicantName = applicantPrefix.replace(/-/g, " ");
  const applicantPage = await signedInPage(browser, applicantPrefix);
  await applicantPage.goto("/app/clubs");
  await applicantPage
    .getByRole("button", { name: `Apply to ${clubName}` })
    .click();
  await expect(
    applicantPage.getByRole("button", {
      name: `Application pending for ${clubName}`,
    }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  await expect(page.getByText(applicantName, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: `Approve ${applicantName}` })
    .click();
  await expect(page.getByText("No pending applications.")).toBeVisible();

  await applicantPage.reload();
  await expect(
    applicantPage.getByRole("heading", { name: clubName }),
  ).toBeVisible();
  await applicantPage.context().close();

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
  await mockArxivLookup(page, owner.userId);
  await page.getByRole("button", { name: "Add paper" }).click();
  const addPaperDialog = page.getByRole("dialog", { name: "Add paper" });
  await addPaperDialog.getByRole("button", { name: "arXiv" }).click();
  await addPaperDialog.getByLabel("arXiv URL or ID").fill("2401.12345");
  await addPaperDialog.getByRole("button", { name: "Lookup" }).click();
  await expect(addPaperDialog.getByText("Efficient Reading Clubs")).toBeVisible();
  await addPaperDialog.getByRole("button", { name: "Add paper" }).click();

  const paperLink = page.getByRole("link", {
    name: "Efficient Reading Clubs",
  });
  await expect(paperLink).toBeVisible();
  await paperLink.click();

  await expect(
    page.getByRole("link", { name: "Open on arXiv" }),
  ).toHaveAttribute("href", "https://arxiv.org/abs/2401.12345");
  await expect(page.getByRole("link", { name: "Open in browser" })).toHaveAttribute(
    "href",
    "https://arxiv.org/pdf/2401.12345",
  );

  await page.getByRole("button", { name: "Log pages" }).click();
  await page.getByLabel("Current page").fill("10");
  await page.getByLabel("Total pages").fill("10");
  await page.getByLabel("Status").selectOption("read");
  await page.getByRole("button", { name: "Save progress" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByText("1/3 read · 10 of 10 pages", { exact: true }),
  ).toBeVisible();

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
  const email = `${prefix}@club-study.test`;
  const displayName = prefix.replace(/-/g, " ");
  const {
    data: { user },
    error: createError,
  } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (createError || !user) {
    throw createError ?? new Error("Test user was not created.");
  }

  usersToDelete.push(user.id);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    avatar_id: "bookworm",
    avatar_color: "#65a30d",
    bio: null,
  });

  if (profileError) {
    throw profileError;
  }

  const expiresIn = 15 * 60;
  const accessToken = createLocalBearer({
    role: "authenticated",
    subject: user.id,
  });
  const session: Session = {
    access_token: accessToken,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    expires_in: expiresIn,
    refresh_token: `unused-local-e2e-${user.id}`,
    token_type: "bearer",
    user,
  };

  await installSession(page, session);

  return { userId: user.id, email, accessToken };
}

async function installSession(page: Page, session: Session) {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: storageKey, value: JSON.stringify(session) },
  );
}

const arxivFixture = {
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
} as const;

async function mockArxivLookup(page: Page, userId: string) {
  await page.route("**/functions/v1/arxiv-lookup", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;

    if (body.action === "lookup") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(arxivFixture),
      });
      return;
    }

    if (body.action === "schedule") {
      const clubId = requiredMockString(body.clubId, "clubId");
      const { data, error } = await admin
        .rpc("import_arxiv_schedule", {
          p_user_id: userId,
          p_club_id: clubId,
          p_week_start: nullableRpcDate(body.deadline),
          p_arxiv_metadata: arxivFixtureJson(),
          p_notes: null,
        });

      if (error || !data) {
        throw error ?? new Error("Mock schedule import returned no row.");
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ schedule_id: data.id }),
      });
      return;
    }

    if (body.action === "personal") {
      const { data, error } = await admin.rpc("import_arxiv_personal", {
        p_user_id: userId,
        p_arxiv_metadata: arxivFixtureJson(),
        p_deadline: nullableRpcDate(body.deadline),
      });

      if (error || !data) {
        throw error ?? new Error("Mock personal import returned no row.");
      }

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ personal_paper_id: data.id }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unknown mock arXiv action." }),
    });
  });
}

function requiredMockString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`Missing mock ${label}.`);
  }

  return value;
}

function optionalMockDate(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function nullableRpcDate(value: unknown) {
  // PostgreSQL accepts NULL here, but generated function argument types do not
  // encode parameter nullability.
  return optionalMockDate(value) as string;
}

function arxivFixtureJson() {
  return {
    ...arxivFixture,
    authors: [...arxivFixture.authors],
  };
}

function getClubIdFromUrl(url: string) {
  const match = /\/app\/clubs\/([^/]+)\/schedule/.exec(url);

  if (!match?.[1]) {
    throw new Error(`Could not find club id in URL: ${url}`);
  }

  return match[1];
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

function readLocalSupabaseStatus() {
  let parsed: unknown;

  try {
    const output = execFileSync(
      "supabase",
      ["status", "--output", "json"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    parsed = JSON.parse(output);
  } catch {
    throw new Error(
      "Local Supabase must be running before E2E tests. Run `supabase start` first.",
    );
  }

  const status =
    parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};

  return {
    apiUrl: requiredStatusValue(status, "API_URL"),
    publishableKey: requiredStatusValue(status, "PUBLISHABLE_KEY"),
  };
}

function requiredStatusValue(
  status: Record<string, unknown>,
  name: "API_URL" | "PUBLISHABLE_KEY",
) {
  const value = status[name];
  if (typeof value !== "string" || !value) {
    throw new Error(`Local Supabase status did not provide ${name}.`);
  }

  return value;
}

function assertMatchingLocalConfig({
  configuredSupabaseUrl,
  configuredPublishableKey,
  localSupabase,
}: {
  configuredSupabaseUrl: string;
  configuredPublishableKey: string;
  localSupabase: ReturnType<typeof readLocalSupabaseStatus>;
}) {
  if (
    configuredSupabaseUrl !== localSupabase.apiUrl ||
    configuredPublishableKey !== localSupabase.publishableKey
  ) {
    throw new Error(
      "Vite Supabase settings do not match the running local project. Refresh .env.local from `supabase status`.",
    );
  }
}

function createLocalBearer({
  role,
  subject,
}: {
  role: "authenticated" | "service_role";
  subject?: string;
}) {
  let bearer: string;

  try {
    const args = [
      "gen",
      "bearer-jwt",
      "--role",
      role,
      "--valid-for",
      "15m",
    ];
    if (subject) {
      args.push("--sub", subject);
    }
    args.push(
      "--payload",
      JSON.stringify({
        aud: "authenticated",
        iss: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
      }),
    );

    bearer = execFileSync(
      "supabase",
      args,
      {
        encoding: "utf8",
        input: "\n",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 10_000,
      },
    ).trim();
  } catch {
    throw new Error(
      `Could not create a short-lived local ${role} bearer. Check the local Supabase signing-key configuration.`,
    );
  }

  if (!isExpectedBearer(bearer, role, subject)) {
    throw new Error(
      `Supabase did not create the expected short-lived ES256 ${role} bearer.`,
    );
  }

  return bearer;
}

function isExpectedBearer(
  value: string,
  role: "authenticated" | "service_role",
  subject?: string,
) {
  const [headerPart, payloadPart, signaturePart] = value.split(".");
  if (!headerPart || !payloadPart || !signaturePart) {
    return false;
  }

  try {
    const header = JSON.parse(
      Buffer.from(headerPart, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    return (
      header.alg === "ES256" &&
      payload.aud === "authenticated" &&
      payload.iss === `${supabaseUrl.replace(/\/$/, "")}/auth/v1` &&
      payload.role === role &&
      (subject === undefined || payload.sub === subject)
    );
  } catch {
    return false;
  }
}
