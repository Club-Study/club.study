# Club email subscriptions

Status: approved for local implementation on 2026-07-12. Do not push or deploy as part of this work.

## Goal

Let a signed-in club member opt into email updates for one club. A subscriber receives:

- one email when a paper is newly scheduled;
- one reminder three calendar days before its current deadline; and
- one reminder one calendar day before its current deadline.

Reminder processing begins at 09:00 `Europe/Oslo`. Papers without a deadline receive only the newly scheduled email.

## Privacy and access

- Subscriptions are member-only and opt-in. Owners and admins follow the same rule.
- Non-members cannot subscribe because an email would reveal private schedule information.
- The public club directory remains limited to club name, description, member count, membership role, and application state.
- Browser clients can read and change only their own subscription rows.
- The delivery outbox, provider identifiers, failure details, and recipient email addresses are never exposed to browser roles.
- Recipient addresses come from `auth.users` only while the privileged delivery batch is being prepared. They are not copied into public application tables.

## User experience

The club header gains an `Email updates` switch for members. Its states are:

- unchecked: email updates are off;
- checked: email updates are on; and
- a disabled pending state while the setting is saved.

Changing the setting displays the existing toast success/error feedback. Unsubscribing immediately removes unsent notifications for that user and club. Removing a member from a club also removes the subscription automatically.

## Data model

### `public.club_email_subscriptions`

One row per subscribing member, keyed by `(club_id, user_id)`. A composite foreign key references the corresponding `club_members` row with `on delete cascade`, enforcing membership and automatic cleanup. RLS permits a user to select, insert, and delete only their own row, with an additional membership predicate for inserts.

### `public.club_email_notifications`

A locked-down outbox containing the subscriber ID, club ID, schedule ID, notification kind, deadline snapshot where applicable, delivery state, attempt count, next-attempt time, lock time, provider message ID, error summary, and timestamps. RLS is enabled and browser roles receive no table grants.

Each row has a unique deterministic deduplication key:

- `scheduled:<schedule-id>:<user-id>`;
- `reminder_3d:<schedule-id>:<user-id>:<deadline>`; or
- `reminder_1d:<schedule-id>:<user-id>:<deadline>`.

This permits a new reminder when a deadline genuinely changes while preventing repeated cron runs from duplicating the same email.

## Notification creation

An `after insert` trigger on `club_paper_schedule` adds a `scheduled` outbox row for every subscriber present in that club at insertion time.

Every dispatcher invocation calls a service-only database function that:

1. obtains the current `Europe/Oslo` date and time;
2. after 09:00, inserts missing three-day and one-day reminder rows for currently subscribed members;
3. ignores undated schedules and already deleted rows; and
4. relies on the unique deduplication key for repeat-safe execution.

A reminder whose deadline snapshot no longer matches the schedule is cancelled before delivery. Subscribers who opt in after a paper was scheduled receive future reminders but not a retroactive newly scheduled email.

## Delivery

A Supabase Edge Function named `club-email-notifications` is invoked every five minutes by Supabase Cron. It is not a browser endpoint and requires a constant-time comparison against an `x-cron-secret` value stored as an Edge Function secret.

The function claims a small batch through service-role-only RPCs using `for update skip locked`. A stale processing lock becomes claimable again after ten minutes unless it was the fifth attempt, in which case it becomes terminally failed. Delivery uses Resend with an idempotency key derived from the outbox row ID.

On success, the row records `sent_at` and the provider message ID. On a retryable error, it returns to pending with bounded exponential delay. Permanent validation errors are marked failed with a short, non-secret error summary. The function response reports counts only and never returns recipient data.

Email content includes the club name, paper title, deadline when present, notification reason, and a canonical `https://cosearch.club/app/papers/<schedule-id>` link. The sender is `cosearch <notifications@cosearch.club>` after the domain is verified in Resend.

## Configuration

Local implementation will document these production values without storing them in git:

- `RESEND_API_KEY` — restricted Resend sending key;
- `CLUB_EMAIL_FROM` — `cosearch <notifications@cosearch.club>`;
- `CLUB_EMAIL_CRON_SECRET` — random secret shared by Cron and the Edge Function;
- `CLUB_EMAIL_APP_URL` — `https://cosearch.club`; and
- two Supabase Vault secrets for the deployed function URL and cron secret.

The migration enables `pg_cron` and `pg_net`, but does not install the environment-specific Cron job. The operator guide supplies exact Dashboard and SQL steps after secrets and the deployed function exist.

## Failure handling

- Missing Resend configuration returns a clear server error and leaves notifications retryable.
- Missing recipient email, deleted user, deleted schedule, stale deadline, lost membership, or an unsubscribed user cancels the pending delivery without leaking details.
- Resend rate limits and transient 5xx/network errors retry with backoff.
- Provider 4xx validation failures become terminal after recording a sanitized message.
- The free-plan daily limit is operationally visible through the outbox state and Resend dashboard.

## Verification

- pgTAP covers RLS, member-only subscription, cascade cleanup, trigger enqueueing, reminder timing, deadline changes, stale reminders, deduplication, and service-only delivery RPC permissions.
- Frontend tests cover the toggle states, mutation errors, and query invalidation.
- Edge tests cover request authentication, email rendering/escaping, Resend success, retryable failure, permanent failure, and idempotency headers using a mock provider endpoint.
- Full typecheck, unit tests, database reset/test, lint, build, PWA verification, and existing Playwright flows run before any completion claim.
- No production migration, Edge deployment, secret change, Cron creation, git push, or merge occurs in this task.

## Small-scale cost

At the prices verified on 2026-07-12, Resend Free includes 3,000 transactional emails per month, up to 100 per day and one sending domain. Supabase Free includes 500,000 Edge Function invocations per month. A five-minute dispatcher uses about 8,640 invocations in a 30-day month. Database storage for subscriptions and the outbox is negligible at small scale.

Each recipient counts as one email. For example, one scheduled paper sent to ten subscribers, followed by both reminders, consumes 30 emails.
