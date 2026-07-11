create type public.club_join_request_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.club_join_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.club_join_request_status not null default 'pending',
  created_at timestamptz not null default pg_catalog.now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id),
  constraint club_join_requests_review_state_check check (
    (
      status = 'pending'::public.club_join_request_status
      and reviewed_at is null
      and reviewed_by is null
    )
    or (
      status in (
        'approved'::public.club_join_request_status,
        'rejected'::public.club_join_request_status
      )
      and reviewed_at is not null
      and reviewed_by is not null
    )
  )
);

create unique index club_join_requests_one_pending_idx
on public.club_join_requests (club_id, user_id)
where status = 'pending'::public.club_join_request_status;

create index club_join_requests_club_status_created_idx
on public.club_join_requests (club_id, status, created_at, id);

create index club_join_requests_user_club_created_idx
on public.club_join_requests (user_id, club_id, created_at desc, id desc);

create index club_join_requests_reviewed_by_idx
on public.club_join_requests (reviewed_by)
where reviewed_by is not null;

alter table public.club_join_requests enable row level security;

revoke all on table public.club_join_requests
from public, anon, authenticated, service_role;

create or replace function public.list_discoverable_clubs()
returns table (
  id uuid,
  name text,
  description text,
  member_count bigint,
  viewer_role public.club_role,
  application_status public.club_join_request_status,
  application_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'sign in required';
  end if;

  return query
  select
    c.id,
    c.name,
    c.description,
    (
      select pg_catalog.count(*)
      from public.club_members counted_members
      where counted_members.club_id = c.id
    ) as member_count,
    viewer_membership.role as viewer_role,
    latest_request.status as application_status,
    latest_request.created_at as application_created_at
  from public.clubs c
  left join public.club_members viewer_membership
    on viewer_membership.club_id = c.id
    and viewer_membership.user_id = v_user_id
  left join lateral (
    select
      join_request.status,
      join_request.created_at
    from public.club_join_requests join_request
    where join_request.club_id = c.id
      and join_request.user_id = v_user_id
    order by join_request.created_at desc, join_request.id desc
    limit 1
  ) latest_request on true
  order by pg_catalog.lower(c.name), c.id;
end;
$$;

create or replace function public.apply_to_club(p_club_id uuid)
returns public.club_join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.club_join_requests;
begin
  if v_user_id is null then
    raise exception 'sign in required';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_user_id
  ) then
    raise exception 'profile required before applying to a club';
  end if;

  if p_club_id is null or not exists (
    select 1
    from public.clubs club
    where club.id = p_club_id
  ) then
    raise exception 'club not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'club-membership:' || p_club_id::text || ':' || v_user_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.club_members member
    where member.club_id = p_club_id
      and member.user_id = v_user_id
  ) then
    raise exception 'already a member of this club';
  end if;

  if exists (
    select 1
    from public.club_join_requests join_request
    where join_request.club_id = p_club_id
      and join_request.user_id = v_user_id
      and join_request.status = 'pending'::public.club_join_request_status
  ) then
    raise exception 'application already pending';
  end if;

  begin
    insert into public.club_join_requests (club_id, user_id)
    values (p_club_id, v_user_id)
    returning * into v_request;
  exception
    when unique_violation then
      raise exception 'application already pending';
  end;

  return v_request;
end;
$$;

create or replace function public.list_club_join_requests(p_club_id uuid)
returns table (
  request_id uuid,
  user_id uuid,
  display_name text,
  avatar_id text,
  avatar_color text,
  bio text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'sign in required';
  end if;

  if p_club_id is null or not exists (
    select 1
    from public.clubs club
    where club.id = p_club_id
  ) then
    raise exception 'club not found';
  end if;

  if not private.is_club_manager(p_club_id) then
    raise exception 'only club owners and admins may review applications';
  end if;

  return query
  select
    join_request.id as request_id,
    join_request.user_id,
    profile.display_name,
    profile.avatar_id,
    profile.avatar_color,
    profile.bio,
    join_request.created_at
  from public.club_join_requests join_request
  join public.profiles profile on profile.id = join_request.user_id
  where join_request.club_id = p_club_id
    and join_request.status = 'pending'::public.club_join_request_status
  order by join_request.created_at, join_request.id;
end;
$$;

create or replace function public.review_club_join_request(
  p_request_id uuid,
  p_decision text
)
returns public.club_join_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  v_club_id uuid;
  v_applicant_id uuid;
  v_request public.club_join_requests;
begin
  if v_reviewer_id is null then
    raise exception 'sign in required';
  end if;

  if v_decision not in ('approved', 'rejected') then
    raise exception 'review decision must be approved or rejected';
  end if;

  select join_request.club_id, join_request.user_id
  into v_club_id, v_applicant_id
  from public.club_join_requests join_request
  where join_request.id = p_request_id;

  if v_club_id is null then
    raise exception 'join request not found';
  end if;

  if not private.is_club_manager(v_club_id) then
    raise exception 'only club owners and admins may review applications';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'club-membership:' || v_club_id::text || ':' || v_applicant_id::text,
      0
    )
  );

  select *
  into v_request
  from public.club_join_requests join_request
  where join_request.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'join request not found';
  end if;

  if v_request.status <> 'pending'::public.club_join_request_status then
    raise exception 'request is no longer pending';
  end if;

  if v_decision = 'approved' then
    insert into public.club_members (club_id, user_id, role)
    values (v_request.club_id, v_request.user_id, 'member'::public.club_role)
    on conflict (club_id, user_id) do nothing;
  end if;

  update public.club_join_requests
  set
    status = v_decision::public.club_join_request_status,
    reviewed_at = pg_catalog.now(),
    reviewed_by = v_reviewer_id
  where id = v_request.id
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.accept_invite(p_token text)
returns public.club_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token_hash text;
  v_invite_id uuid;
  v_invite public.club_invites;
  v_membership public.club_members;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = v_user_id
  ) then
    raise exception 'profile required before accepting an invite';
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.btrim(p_token), 'sha256'),
    'hex'
  );

  select *
  into v_invite
  from public.club_invites invite
  where invite.token_hash = v_token_hash;

  if v_invite.id is null then
    raise exception 'invite not found';
  end if;

  v_invite_id := v_invite.id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'club-membership:' || v_invite.club_id::text || ':' || v_user_id::text,
      0
    )
  );

  select *
  into v_invite
  from public.club_invites invite
  where invite.id = v_invite_id
  for update;

  if v_invite.status <> 'pending'::public.invite_status then
    raise exception 'invite is no longer pending';
  end if;

  if v_invite.expires_at is not null
    and v_invite.expires_at <= pg_catalog.now() then
    raise exception 'invite has expired';
  end if;

  if exists (
    select 1
    from public.club_members member
    where member.club_id = v_invite.club_id
      and member.user_id = v_user_id
  ) then
    raise exception 'already a member of this club';
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (v_invite.club_id, v_user_id, 'member'::public.club_role)
  returning * into v_membership;

  update public.club_join_requests
  set
    status = 'approved'::public.club_join_request_status,
    reviewed_at = pg_catalog.now(),
    reviewed_by = v_invite.created_by
  where club_id = v_invite.club_id
    and user_id = v_user_id
    and status = 'pending'::public.club_join_request_status;

  update public.club_invites
  set
    status = 'accepted'::public.invite_status,
    accepted_by = v_user_id,
    accepted_at = pg_catalog.now()
  where id = v_invite.id;

  return v_membership;
end;
$$;

revoke all on function public.list_discoverable_clubs()
from public, anon, authenticated, service_role;
revoke all on function public.apply_to_club(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.list_club_join_requests(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.review_club_join_request(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.list_discoverable_clubs()
to authenticated;
grant execute on function public.apply_to_club(uuid)
to authenticated;
grant execute on function public.list_club_join_requests(uuid)
to authenticated;
grant execute on function public.review_club_join_request(uuid, text)
to authenticated;
