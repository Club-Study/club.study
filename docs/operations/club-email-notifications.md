# Club email notifications: setup and operations

This runbook configures the opt-in club email feature for `https://cosearch.club` and Supabase project `jcoyapyzwpggynnwooag`.

The implementation sends one email when a new paper is scheduled, then reminders at or after 09:00 Europe/Oslo three days and one day before its scheduled date. Only confirmed club members can subscribe. A member can turn updates off from the club page; doing so removes unsent work.

Do not commit or paste the Resend API key or cron secret into source control, an issue, a pull request, or chat.

## What is already in the code

- `club_email_subscriptions` is protected by RLS and tied to confirmed membership.
- The delivery outbox is inaccessible to browser roles.
- Service-role-only functions enqueue, claim, and resolve bounded batches.
- The worker uses retries, stale-lock recovery, and a per-notification Resend idempotency key.
- Email HTML is escaped, and responses/logs do not expose recipient addresses.
- The Cron endpoint has platform JWT verification disabled because it uses its own 32+ character `x-cron-secret` check.

The code does **not** create production secrets, deploy the function, migrate production, or create a production Cron job automatically.

## 1. Verify the sending domain in Resend

1. Sign in at [Resend](https://resend.com/).
2. Open **Domains** and select **Add Domain**.
3. Enter `cosearch.club` and add it.
4. Leave the Resend domain page open. It displays the exact SPF/MX and DKIM records assigned to this account.
5. In another tab, open Vercel, select the `cosearch.club` domain, then open **DNS Records**.
6. Add every record shown by Resend one by one:
   - copy Resend's record **Type** to Vercel's **Type**;
   - copy only the host/prefix to Vercel's **Name** (Vercel appends `.cosearch.club`);
   - copy Resend's value exactly to Vercel's **Value**;
   - for an MX record, also copy Resend's priority;
   - keep Vercel's default TTL unless Resend explicitly requires another value.
7. Do not invent, combine, or replace the record values. They are account-specific.
8. Return to Resend and click **Verify DNS Records**. Verification often finishes quickly but DNS propagation can take longer.
9. Continue only when Resend shows the domain as **Verified**.

Resend currently requires SPF and DKIM to verify a domain and recommends DMARC as an optional follow-up. Vercel's DNS UI expects the host prefix—not the entire domain—in the Name field. See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction) and [Vercel DNS record management](https://vercel.com/kb/guide/how-to-manage-vercel-dns-records).

## 2. Create a restricted Resend key

1. In Resend, open **API Keys** and click **Create API Key**.
2. Name it `cosearch club production`.
3. Choose **Sending access**, not Full access.
4. Restrict it to `cosearch.club`.
5. Create the key and copy it immediately into a password manager. Resend only shows the full value once.

The key should start with `re_`. Do not put it in a Vite/Vercel `VITE_*` variable; this is a server-only Supabase Edge secret. See [Resend API-key permissions](https://resend.com/docs/dashboard/api-keys/introduction).

## 3. Generate the shared Cron secret

Run this locally:

```sh
openssl rand -hex 32
```

This prints a 64-character secret. Save it in the password manager as `cosearch club email cron secret`. The exact same value must be added to Supabase Edge Function Secrets and Supabase Vault in the next steps.

## 4. Add the Edge Function secrets

1. Open the Supabase project `jcoyapyzwpggynnwooag`.
2. Open **Edge Functions → Secrets**.
3. Add these four values:

| Key | Value |
| --- | --- |
| `RESEND_API_KEY` | the restricted `re_...` key from Resend |
| `CLUB_EMAIL_FROM` | `cosearch <notifications@cosearch.club>` |
| `CLUB_EMAIL_CRON_SECRET` | the 64-character value from step 3 |
| `CLUB_EMAIL_APP_URL` | `https://cosearch.club` |

4. Save the secrets.
5. Do **not** create `RESEND_API_URL` in production. The code then uses Resend's official HTTPS endpoint.

Supabase makes project URL and secret API keys available to Edge Functions automatically. There is no need to copy a service-role key into a new custom secret. See [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).

## 5. Validate and migrate the production database

Run from the repository root after the feature branch has been reviewed and is the exact version intended for release:

```sh
supabase migration list --linked
supabase db push --linked --dry-run
```

The dry-run must list `20260712131010_club_email_subscriptions.sql` and no unexpected migration. Then apply it:

```sh
supabase db push --linked
supabase migration list --linked
```

Confirm the local and remote entries for `20260712131010` now match. Do not deploy the subscription UI before this migration exists remotely.

## 6. Deploy the Edge Function

Deploy the committed source directly from the repository:

```sh
supabase functions deploy club-email-notifications \
  --project-ref jcoyapyzwpggynnwooag \
  --no-verify-jwt
```

The `--no-verify-jwt` setting is intentional. The endpoint is service-to-service and rejects requests unless `x-cron-secret` exactly matches the separate secret. It never accepts a browser session as authorization.

Its production URL is:

```text
https://jcoyapyzwpggynnwooag.supabase.co/functions/v1/club-email-notifications
```

## 7. Test endpoint authentication before adding Cron

First confirm a bad secret is rejected and does no database work:

```sh
curl -i --request POST \
  'https://jcoyapyzwpggynnwooag.supabase.co/functions/v1/club-email-notifications' \
  --header 'x-cron-secret: deliberately-wrong'
```

Expected status: `401` with `{"error":"Unauthorized."}`.

Now load the real secret without putting its value in shell history:

```sh
read -rsp 'Cron secret: ' CLUB_EMAIL_CRON_SECRET; echo
curl --fail-with-body --request POST \
  'https://jcoyapyzwpggynnwooag.supabase.co/functions/v1/club-email-notifications' \
  --header "x-cron-secret: ${CLUB_EMAIL_CRON_SECRET}"
unset CLUB_EMAIL_CRON_SECRET
```

A healthy empty run returns counts similar to:

```json
{"queued":0,"claimed":0,"sent":0,"retried":0,"failed":0,"cancelled":0,"resolutionFailed":0}
```

This call can send any pending production notifications. At this point that is expected; do not run it against a database containing work you do not want delivered.

## 8. Store the endpoint and shared secret in Vault

Open **Supabase → SQL Editor**. Replace only `<PASTE_THE_64_CHARACTER_CRON_SECRET>` and run:

```sql
select vault.create_secret(
  'https://jcoyapyzwpggynnwooag.supabase.co/functions/v1/club-email-notifications',
  'club_email_function_url',
  'Endpoint invoked by the club email Cron job'
);

select vault.create_secret(
  '<PASTE_THE_64_CHARACTER_CRON_SECRET>',
  'club_email_cron_secret',
  'Shared header secret for the club email Cron job'
);
```

Verify only the names—not decrypted values:

```sql
select name, description, created_at
from vault.secrets
where name in ('club_email_function_url', 'club_email_cron_secret')
order by name;
```

Both names must appear exactly once. Vault stores the values encrypted at rest; access to `vault.decrypted_secrets` must remain restricted. See [Supabase Vault](https://supabase.com/docs/guides/database/vault).

If either name already exists, do not create a duplicate. Open **Vault** in the Supabase dashboard and update the existing secret so the Edge and Vault copies still match.

## 9. Create the five-minute Cron job

Run this in the Supabase SQL Editor:

```sql
select cron.schedule(
  'dispatch-club-email-notifications',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'club_email_function_url'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'club_email_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $job$
);
```

`pg_cron` runs this every five minutes and `pg_net` performs the HTTP request after the transaction commits. The database function itself enforces the 09:00 Europe/Oslo reminder threshold and uses dedupe keys, so frequent invocations do not create duplicate reminders. This follows Supabase's documented [scheduled Edge Function](https://supabase.com/docs/guides/functions/schedule-functions) pattern.

Confirm exactly one active job exists:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-club-email-notifications';
```

Expected: one row, `*/5 * * * *`, `active = true`.

## 10. End-to-end production test

1. Sign in at `https://cosearch.club` with a confirmed test email address.
2. Open a club where that user is already a member.
3. Enable **Email updates**.
4. As the owner/admin, schedule a harmless test paper with a future date.
5. Wait up to five minutes.
6. Confirm the new-paper email arrives and its **Open paper** button returns to `https://cosearch.club/app/papers/...` after sign-in.
7. Turn **Email updates** off.
8. Schedule a second test paper and confirm no email is delivered to that user.

For deterministic reminder verification without waiting three days, use a non-production/local database. Do not manually change production dates solely to force a reminder.

## 11. Monitor delivery

Cron run history:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'dispatch-club-email-notifications'
)
order by start_time desc
limit 20;
```

Outbox totals (database owner only):

```sql
select kind, state, count(*)
from public.club_email_notifications
group by kind, state
order by kind, state;
```

Failures needing attention:

```sql
select id, kind, attempts, last_error, updated_at
from public.club_email_notifications
where state = 'failed'
order by updated_at desc
limit 50;
```

Also check **Supabase → Edge Functions → club-email-notifications → Logs** and Resend's email/log dashboard. The function intentionally logs only generic operational failures, not recipients or provider response bodies.

Interpret the response counters as follows:

- `queued`: new three-day/one-day reminders created during this invocation;
- `claimed`: jobs locked for this invocation;
- `sent`: Resend accepted and returned a message ID;
- `retried`: temporary provider/network failures rescheduled with backoff;
- `failed`: invalid or terminal jobs after validation/retry limits;
- `cancelled`: unconfirmed recipient or no-longer-eligible work;
- `resolutionFailed`: a database status race/failure; stale lock recovery retries after ten minutes.

## 12. Disable safely

Stop new worker invocations first:

```sql
select cron.unschedule('dispatch-club-email-notifications');
```

Confirm no row remains:

```sql
select jobid, jobname, active
from cron.job
where jobname = 'dispatch-club-email-notifications';
```

Then, if the feature is being retired rather than temporarily paused:

1. Remove the UI feature in a normal code deployment.
2. Remove the four custom values from **Edge Functions → Secrets**.
3. Remove `club_email_function_url` and `club_email_cron_secret` through the Supabase Vault UI.
4. Revoke the `cosearch club production` API key in Resend.

Do not drop the tables or enums as an emergency rollback. Leaving them in place is backward-compatible and preserves audit/debug state while the Cron job is stopped.

## 13. Local verification without sending real mail

The pure rendering, provider classification, authentication, retry, and idempotency paths run in Vitest:

```sh
npm test -- \
  supabase/functions/club-email-notifications/email.test.ts \
  supabase/functions/club-email-notifications/handler.test.ts
```

For a local Edge-runtime smoke test:

1. Create `supabase/functions/.env.local`. This path is already covered by the repository's `.env.*` ignore rule.
2. Put these non-production values in it:

```dotenv
RESEND_API_KEY=re_local_not_used_on_an_empty_database
CLUB_EMAIL_FROM=cosearch local <notifications@cosearch.club>
CLUB_EMAIL_CRON_SECRET=0123456789abcdef0123456789abcdef
CLUB_EMAIL_APP_URL=http://127.0.0.1:5173
```

3. Reset to an empty local database, serve the functions, and leave the server running:

```sh
supabase db reset --local --no-seed
supabase functions serve --env-file supabase/functions/.env.local --no-verify-jwt
```

4. In another terminal, verify bad-secret rejection:

```sh
curl -i --request POST \
  'http://127.0.0.1:54321/functions/v1/club-email-notifications' \
  --header 'x-cron-secret: wrong'
```

5. Verify an authorized empty run:

```sh
curl --fail-with-body --request POST \
  'http://127.0.0.1:54321/functions/v1/club-email-notifications' \
  --header 'x-cron-secret: 0123456789abcdef0123456789abcdef'
```

The fake Resend key is safe only while the local database has no claimed notifications. Unit tests use an injected fake HTTP client and never contact Resend.

## Cost at small scale

As of July 2026:

- Resend Free includes 3,000 transactional emails per month, with a 100-email daily cap and one domain. See [Resend pricing](https://resend.com/pricing).
- Supabase Free includes 500,000 Edge Function invocations per month. See [Supabase Edge invocation usage](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations).
- A five-minute Cron schedule invokes the function about 8,640 times in a 30-day month, roughly 1.7% of that Edge quota.
- Each subscribed member can receive up to three messages per scheduled paper: new schedule, three-day reminder, and one-day reminder.

Therefore this stack is free at small scale, provided total Resend traffic stays below both 100 emails per day and 3,000 per month and the rest of the Supabase project remains within its Free quotas. The already-purchased domain remains a separate cost. Free projects that are paused cannot run Cron or Edge work until resumed; a reminder missed for an entire calendar day is not backfilled.
