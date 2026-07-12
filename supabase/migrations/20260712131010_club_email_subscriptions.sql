create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create type public.club_email_notification_kind as enum (
  'scheduled',
  'reminder_3d',
  'reminder_1d'
);

create type public.club_email_notification_state as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled'
);

create table public.club_email_subscriptions (
  club_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (club_id, user_id),
  foreign key (club_id, user_id)
    references public.club_members (club_id, user_id)
    on delete cascade
);

create table public.club_email_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  schedule_id uuid not null
    references public.club_paper_schedule (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.club_email_notification_kind not null,
  deadline_snapshot date,
  dedupe_key text not null unique
    check (pg_catalog.char_length(dedupe_key) between 1 and 240),
  state public.club_email_notification_state not null default 'pending',
  attempts smallint not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default pg_catalog.now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text
    check (
      provider_message_id is null
      or pg_catalog.char_length(provider_message_id) <= 256
    ),
  last_error text
    check (last_error is null or pg_catalog.char_length(last_error) <= 500),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint club_email_notifications_deadline_kind_check check (
    (kind = 'scheduled' and deadline_snapshot is null)
    or (
      kind in ('reminder_3d', 'reminder_1d')
      and deadline_snapshot is not null
    )
  ),
  constraint club_email_notifications_lock_state_check check (
    (state = 'processing' and locked_at is not null)
    or (state <> 'processing' and locked_at is null)
  ),
  constraint club_email_notifications_sent_state_check check (
    (state = 'sent' and sent_at is not null)
    or (state <> 'sent' and sent_at is null)
  )
);

create index club_email_notifications_pending_idx
on public.club_email_notifications (available_at, created_at, id)
where state = 'pending';

create index club_email_notifications_processing_idx
on public.club_email_notifications (locked_at, id)
where state = 'processing';

create index club_email_notifications_club_user_active_idx
on public.club_email_notifications (club_id, user_id, state)
where state in ('pending', 'processing', 'failed');

create index club_email_notifications_user_club_idx
on public.club_email_notifications (user_id, club_id);

create index club_email_notifications_schedule_idx
on public.club_email_notifications (schedule_id);

alter table public.club_email_subscriptions enable row level security;
alter table public.club_email_notifications enable row level security;

create policy "club email subscriptions select own"
on public.club_email_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "club email subscriptions insert own membership"
on public.club_email_subscriptions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_club_member(club_id))
);

create policy "club email subscriptions delete own"
on public.club_email_subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.enqueue_new_club_paper_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.club_email_notifications (
    club_id,
    schedule_id,
    user_id,
    kind,
    deadline_snapshot,
    dedupe_key
  )
  select
    subscription.club_id,
    new.id,
    subscription.user_id,
    'scheduled'::public.club_email_notification_kind,
    null,
    'scheduled:' || new.id::text || ':' || subscription.user_id::text
  from public.club_email_subscriptions subscription
  where subscription.club_id = new.club_id
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

create trigger club_paper_schedule_enqueue_email
after insert on public.club_paper_schedule
for each row execute function private.enqueue_new_club_paper_emails();

create or replace function private.delete_unsubscribed_club_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.club_email_notifications notification
  where notification.club_id = old.club_id
    and notification.user_id = old.user_id
    and notification.state in (
      'pending'::public.club_email_notification_state,
      'processing'::public.club_email_notification_state,
      'failed'::public.club_email_notification_state,
      'cancelled'::public.club_email_notification_state
    );

  return old;
end;
$$;

create trigger club_email_subscriptions_delete_pending
after delete on public.club_email_subscriptions
for each row execute function private.delete_unsubscribed_club_emails();

create or replace function public.queue_due_club_email_reminders(
  p_now timestamptz default pg_catalog.now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local_now timestamp;
  v_inserted integer := 0;
begin
  if p_now is null then
    raise exception 'notification time is required';
  end if;

  v_local_now := p_now at time zone 'Europe/Oslo';

  if v_local_now::time < time '09:00:00' then
    return 0;
  end if;

  insert into public.club_email_notifications (
    club_id,
    schedule_id,
    user_id,
    kind,
    deadline_snapshot,
    dedupe_key,
    available_at
  )
  select
    schedule.club_id,
    schedule.id,
    subscription.user_id,
    reminder.kind,
    schedule.week_start,
    reminder.kind::text || ':' || schedule.id::text || ':'
      || subscription.user_id::text || ':' || schedule.week_start::text,
    p_now
  from public.club_paper_schedule schedule
  join public.club_email_subscriptions subscription
    on subscription.club_id = schedule.club_id
  cross join lateral (
    values
      ('reminder_3d'::public.club_email_notification_kind, 3),
      ('reminder_1d'::public.club_email_notification_kind, 1)
  ) as reminder(kind, days_before)
  where schedule.week_start is not null
    and schedule.week_start = v_local_now::date + reminder.days_before
  on conflict (dedupe_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.claim_club_email_notifications(
  p_limit integer default 25,
  p_now timestamptz default pg_catalog.now()
)
returns table (
  notification_id uuid,
  notification_kind public.club_email_notification_kind,
  recipient_email text,
  recipient_name text,
  club_id uuid,
  club_name text,
  schedule_id uuid,
  paper_title text,
  deadline date,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_now is null then
    raise exception 'notification time is required';
  end if;

  if p_limit not between 1 and 50 then
    raise exception 'notification claim limit must be between 1 and 50';
  end if;

  update public.club_email_notifications notification
  set
    state = 'cancelled'::public.club_email_notification_state,
    locked_at = null,
    last_error = null
  where (
      notification.state = 'pending'::public.club_email_notification_state
      or (
        notification.state = 'processing'::public.club_email_notification_state
        and notification.locked_at <= p_now - interval '10 minutes'
      )
    )
    and (
      not exists (
        select 1
        from public.club_email_subscriptions subscription
        where subscription.club_id = notification.club_id
          and subscription.user_id = notification.user_id
      )
      or (
        notification.kind <> 'scheduled'::public.club_email_notification_kind
        and not exists (
          select 1
          from public.club_paper_schedule schedule
          where schedule.id = notification.schedule_id
            and schedule.week_start = notification.deadline_snapshot
        )
      )
    );

  update public.club_email_notifications notification
  set
    state = 'failed'::public.club_email_notification_state,
    locked_at = null,
    last_error = 'Delivery worker stopped after the final attempt'
  where notification.state = 'processing'::public.club_email_notification_state
    and notification.attempts >= 5
    and notification.locked_at <= p_now - interval '10 minutes';

  return query
  with candidates as (
    select notification.id
    from public.club_email_notifications notification
    where notification.attempts < 5
      and (
        (
          notification.state = 'pending'::public.club_email_notification_state
          and notification.available_at <= p_now
        )
        or (
          notification.state = 'processing'::public.club_email_notification_state
          and notification.locked_at <= p_now - interval '10 minutes'
        )
      )
    order by notification.available_at, notification.created_at, notification.id
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.club_email_notifications notification
    set
      state = 'processing'::public.club_email_notification_state,
      attempts = notification.attempts + 1,
      locked_at = p_now,
      last_error = null
    from candidates
    where notification.id = candidates.id
    returning notification.*
  )
  select
    claimed.id,
    claimed.kind,
    case
      when account.email_confirmed_at is not null then account.email::text
      else null
    end,
    profile.display_name,
    claimed.club_id,
    club.name,
    claimed.schedule_id,
    paper.title,
    case
      when claimed.kind = 'scheduled'::public.club_email_notification_kind
        then schedule.week_start
      else claimed.deadline_snapshot
    end,
    claimed.attempts::integer
  from claimed
  join auth.users account on account.id = claimed.user_id
  join public.profiles profile on profile.id = claimed.user_id
  join public.clubs club on club.id = claimed.club_id
  join public.club_paper_schedule schedule on schedule.id = claimed.schedule_id
  join public.papers paper on paper.id = schedule.paper_id
  order by claimed.available_at, claimed.created_at, claimed.id;
end;
$$;

create or replace function public.resolve_club_email_notification(
  p_notification_id uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error text default null,
  p_retry_at timestamptz default null,
  p_now timestamptz default pg_catalog.now()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outcome text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_outcome, '')));
  v_attempts smallint;
begin
  if p_notification_id is null or p_now is null then
    raise exception 'notification id and time are required';
  end if;

  if v_outcome not in ('sent', 'retry', 'failed', 'cancelled') then
    raise exception 'notification outcome is invalid';
  end if;

  select notification.attempts
  into v_attempts
  from public.club_email_notifications notification
  where notification.id = p_notification_id
    and notification.state = 'processing'::public.club_email_notification_state
  for update;

  if v_attempts is null then
    return false;
  end if;

  if v_outcome = 'sent' then
    if nullif(pg_catalog.btrim(coalesce(p_provider_message_id, '')), '') is null then
      raise exception 'provider message id is required for sent notifications';
    end if;

    update public.club_email_notifications
    set
      state = 'sent'::public.club_email_notification_state,
      locked_at = null,
      sent_at = p_now,
      provider_message_id = pg_catalog.left(p_provider_message_id, 256),
      last_error = null
    where id = p_notification_id;
  elsif v_outcome = 'retry' and v_attempts < 5 then
    if p_retry_at is null or p_retry_at <= p_now then
      raise exception 'a future retry time is required';
    end if;

    update public.club_email_notifications
    set
      state = 'pending'::public.club_email_notification_state,
      locked_at = null,
      available_at = p_retry_at,
      provider_message_id = null,
      last_error = pg_catalog.left(
        coalesce(nullif(pg_catalog.btrim(p_error), ''), 'Temporary delivery failure'),
        500
      )
    where id = p_notification_id;
  elsif v_outcome = 'cancelled' then
    update public.club_email_notifications
    set
      state = 'cancelled'::public.club_email_notification_state,
      locked_at = null,
      provider_message_id = null,
      last_error = null
    where id = p_notification_id;
  else
    update public.club_email_notifications
    set
      state = 'failed'::public.club_email_notification_state,
      locked_at = null,
      provider_message_id = null,
      last_error = pg_catalog.left(
        coalesce(nullif(pg_catalog.btrim(p_error), ''), 'Delivery failed'),
        500
      )
    where id = p_notification_id;
  end if;

  return true;
end;
$$;

create trigger club_email_notifications_set_updated_at
before update on public.club_email_notifications
for each row execute function public.set_updated_at();

revoke all on table public.club_email_subscriptions
from public, anon, authenticated, service_role;
revoke all on table public.club_email_notifications
from public, anon, authenticated, service_role;

grant select, delete on table public.club_email_subscriptions to authenticated;
grant insert (club_id, user_id) on table public.club_email_subscriptions
to authenticated;

revoke all on function private.enqueue_new_club_paper_emails()
from public, anon, authenticated, service_role;
revoke all on function private.delete_unsubscribed_club_emails()
from public, anon, authenticated, service_role;

revoke all on function public.queue_due_club_email_reminders(timestamptz)
from public, anon, authenticated, service_role;
revoke all on function public.claim_club_email_notifications(integer, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function public.resolve_club_email_notification(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz
)
from public, anon, authenticated, service_role;

grant execute on function public.queue_due_club_email_reminders(timestamptz)
to service_role;
grant execute on function public.claim_club_email_notifications(integer, timestamptz)
to service_role;
grant execute on function public.resolve_club_email_notification(
  uuid,
  text,
  text,
  text,
  timestamptz,
  timestamptz
)
to service_role;
