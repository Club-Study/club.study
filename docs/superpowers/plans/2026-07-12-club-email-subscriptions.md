# Club email subscriptions implementation plan

Scope: local branch only. Do not push, deploy, set production secrets, create a production Cron job, or migrate the linked database.

## 1. Database contract

Files:

- `supabase/migrations/*_club_email_subscriptions.sql`
- `supabase/tests/rls_mvp.sql`
- `src/lib/supabase/database.types.ts`

Steps:

1. Generate the migration with `supabase migration new club_email_subscriptions`.
2. Add notification kind/state enums, member-scoped subscriptions, and a locked outbox.
3. Add supporting indexes for due work, stale locks, schedule cleanup, and user/club cleanup.
4. Add RLS and minimum grants for a user's own subscription only.
5. Add RLS-protected subscription writes and service-role-only enqueue/claim/complete/fail RPCs.
6. Add schedule insertion and unsubscribe cleanup triggers.
7. Rebuild a clean local database and extend pgTAP for access control, timing, deduplication, retry, deadline changes, and cascade behavior.
8. Regenerate checked-in Supabase TypeScript types from the clean schema.

## 2. Frontend control

Files:

- `src/features/clubs/api.ts`
- `src/features/clubs/queries.ts`
- `src/features/clubs/ClubShell.tsx`
- `src/features/clubs/ClubShell.test.tsx`
- `src/features/clubs/api.test.ts`
- `src/lib/queryKeys.ts`
- `src/lib/user-facing-error.ts`

Steps:

1. Add typed read/write helpers for current-user subscription state.
2. Add a dedicated React Query key and query option.
3. Render an `Email updates` toggle only after membership is confirmed.
4. Preserve mobile truncation and manager edit actions.
5. Invalidate subscription state after mutation and show safe toast messages.
6. Add component and API-normalization coverage.

## 3. Edge delivery

Files:

- `supabase/config.toml`
- `supabase/functions/.env.example`
- `supabase/functions/club-email-notifications/index.ts`
- `supabase/functions/club-email-notifications/email.ts`
- `supabase/functions/club-email-notifications/email.test.ts`

Steps:

1. Add a server-only Edge Function with gateway JWT verification disabled and an internal cron-secret check.
2. Call service-only RPCs to enqueue due reminders and claim a bounded batch.
3. Render escaped HTML and text variants with canonical links.
4. Call Resend with a stable idempotency key and strict timeouts.
5. Mark success, retryable failure, terminal failure, or cancelled delivery without returning recipient data.
6. Unit-test auth, rendering, request construction, classification, and idempotency using injected dependencies.

## 4. Operator guide

File:

- `docs/operations/club-email-notifications.md`

Steps:

1. Document Resend account creation and `cosearch.club` domain verification.
2. Document exact Vercel DNS entry placement and verification checks.
3. Document restricted Resend key creation and Supabase Edge secrets.
4. Document local test environment values and mock-safe invocation.
5. Document Edge deployment, Vault secrets, `pg_cron`/`pg_net` job SQL, and dry-run checks.
6. Document monitoring, free-tier limits, pause behavior, rollback, and disable procedures.

## 5. Verification and local handoff

1. Run `supabase db reset --local --no-seed`.
2. Run pgTAP, database lint, and migration-list checks.
3. Run Edge unit tests and a local unauthorized invocation smoke test.
4. Run Vitest, typecheck, ESLint, production build, PWA verification, and Playwright.
5. Run `npm audit` and `git diff --check`.
6. Inspect the final diff and commit intended files locally.
7. Confirm the branch has no upstream and no production mutation occurred.
