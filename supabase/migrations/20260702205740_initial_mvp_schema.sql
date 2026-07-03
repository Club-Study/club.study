create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.club_role as enum ('owner', 'member');
create type public.invite_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);
create type public.paper_source_type as enum ('arxiv', 'manual');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(btrim(display_name)) between 1 and 120
  ),
  avatar_url text check (
    avatar_url is null
    or avatar_url ~ '^https?://'
  ),
  bio text check (
    bio is null
    or char_length(bio) <= 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text unique not null check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 64
  ),
  description text check (
    description is null
    or char_length(description) <= 500
  ),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.club_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.club_invites (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  token_hash text unique not null,
  status public.invite_status not null default 'pending',
  created_by uuid not null references public.profiles (id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_by uuid references public.profiles (id),
  accepted_at timestamptz,
  check (
    expires_at is null
    or expires_at > created_at
  )
);

create table public.papers (
  id uuid primary key default extensions.gen_random_uuid(),
  source_type public.paper_source_type not null,
  title text not null check (char_length(btrim(title)) between 1 and 500),
  authors jsonb not null default '[]'::jsonb check (
    jsonb_typeof(authors) = 'array'
  ),
  abstract text,
  doi text,
  license text,
  arxiv_id text,
  abstract_url text,
  pdf_url text,
  external_url text,
  published_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint papers_source_metadata_check check (
    (
      source_type = 'arxiv'
      and arxiv_id is not null
      and arxiv_id !~ 'v[0-9]+$'
      and arxiv_id ~ '^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+/[0-9]{7})$'
      and abstract_url = 'https://arxiv.org/abs/' || arxiv_id
      and pdf_url = 'https://arxiv.org/pdf/' || arxiv_id
      and external_url is null
    )
    or (
      source_type = 'manual'
      and external_url is not null
      and arxiv_id is null
      and abstract_url is null
      and pdf_url is null
    )
  )
);

create table public.club_paper_schedule (
  id uuid primary key default extensions.gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  week_start date not null,
  notes text check (
    notes is null
    or char_length(notes) <= 2000
  ),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint club_paper_schedule_week_start_monday_check check (
    extract(isodow from week_start) = 1
  ),
  constraint club_paper_schedule_club_week_unique unique (club_id, week_start)
);

create table public.reading_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_id uuid not null references public.club_paper_schedule (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  constraint reading_logs_schedule_user_unique unique (schedule_id, user_id)
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_id uuid not null references public.club_paper_schedule (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index clubs_created_by_idx on public.clubs (created_by);
create index club_members_user_id_club_id_idx on public.club_members (user_id, club_id);
create index club_invites_club_id_status_idx on public.club_invites (club_id, status);
create unique index club_invites_one_pending_per_club_idx on public.club_invites (club_id)
where
  status = 'pending';
create index club_invites_created_by_idx on public.club_invites (created_by);
create index club_invites_accepted_by_idx on public.club_invites (accepted_by);
create unique index papers_arxiv_id_unique_idx on public.papers (arxiv_id)
where
  arxiv_id is not null;
create index club_paper_schedule_paper_id_idx on public.club_paper_schedule (paper_id);
create index club_paper_schedule_created_by_idx on public.club_paper_schedule (created_by);
create index reading_logs_user_id_read_at_idx on public.reading_logs (user_id, read_at);
create index reading_logs_schedule_id_idx on public.reading_logs (schedule_id);
create index comments_author_id_idx on public.comments (author_id);
create index comments_schedule_id_created_at_active_idx on public.comments (
  schedule_id,
  created_at
)
where
  deleted_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_comment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if new.id is distinct from old.id
    or new.schedule_id is distinct from old.schedule_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'comment identity fields are immutable';
  end if;

  if old.deleted_at is not null then
    raise exception 'deleted comments cannot be updated';
  end if;

  if v_user_id = old.author_id then
    return new;
  end if;

  if private.is_schedule_owner(old.schedule_id) then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'owners can only soft-delete comments';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update comment';
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger clubs_set_updated_at
before update on public.clubs
for each row execute function public.set_updated_at();

create trigger papers_set_updated_at
before update on public.papers
for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create trigger comments_guard_update
before update on public.comments
for each row execute function public.guard_comment_update();

create or replace function private.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'owner'
  );
$$;

create or replace function private.is_schedule_member(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_paper_schedule cps
    join public.club_members cm on cm.club_id = cps.club_id
    where cps.id = p_schedule_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_schedule_owner(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_paper_schedule cps
    join public.club_members cm on cm.club_id = cps.club_id
    where cps.id = p_schedule_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'owner'
  );
$$;

create or replace function private.shares_club_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.club_members mine
      join public.club_members theirs on theirs.club_id = mine.club_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_user_id
    );
$$;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;
alter table public.papers enable row level security;
alter table public.club_paper_schedule enable row level security;
alter table public.reading_logs enable row level security;
alter table public.comments enable row level security;

create policy "profiles select own or shared club"
on public.profiles
for select
to authenticated
using (private.shares_club_with(id));

create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles update own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "clubs select members"
on public.clubs
for select
to authenticated
using (private.is_club_member(id));

create policy "clubs update owners"
on public.clubs
for update
to authenticated
using (private.is_club_owner(id))
with check (private.is_club_owner(id));

create policy "club members select club members"
on public.club_members
for select
to authenticated
using (private.is_club_member(club_id));

create policy "club members insert by owners"
on public.club_members
for insert
to authenticated
with check (private.is_club_owner(club_id));

create policy "club members update by owners"
on public.club_members
for update
to authenticated
using (private.is_club_owner(club_id))
with check (private.is_club_owner(club_id));

create policy "club members delete by owners"
on public.club_members
for delete
to authenticated
using (private.is_club_owner(club_id));

create policy "club invites select owners"
on public.club_invites
for select
to authenticated
using (private.is_club_owner(club_id));

create policy "papers select scheduled club papers"
on public.papers
for select
to authenticated
using (
  exists (
    select 1
    from public.club_paper_schedule cps
    where cps.paper_id = papers.id
      and private.is_club_member(cps.club_id)
  )
);

create policy "club schedule select members"
on public.club_paper_schedule
for select
to authenticated
using (private.is_club_member(club_id));

create policy "club schedule delete owners"
on public.club_paper_schedule
for delete
to authenticated
using (private.is_club_owner(club_id));

create policy "reading logs select own"
on public.reading_logs
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "comments select schedule members"
on public.comments
for select
to authenticated
using (private.is_schedule_member(schedule_id));

create policy "comments insert schedule members"
on public.comments
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and deleted_at is null
  and private.is_schedule_member(schedule_id)
);

create policy "comments update authors"
on public.comments
for update
to authenticated
using (author_id = (select auth.uid()))
with check (
  private.is_schedule_member(schedule_id)
  and author_id = (select auth.uid())
);

create policy "comments soft delete owners"
on public.comments
for update
to authenticated
using (private.is_schedule_owner(schedule_id))
with check (
  private.is_schedule_owner(schedule_id)
  and deleted_at is not null
);

create or replace function public.create_club(
  p_name text,
  p_slug text,
  p_description text default null
)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_club public.clubs;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'profile required before creating a club';
  end if;

  insert into public.clubs (name, slug, description, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), nullif(btrim(p_description), ''), v_user_id)
  returning * into v_club;

  insert into public.club_members (club_id, user_id, role)
  values (v_club.id, v_user_id, 'owner');

  return v_club;
end;
$$;

create or replace function public.create_invite_link(
  p_club_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  id uuid,
  token text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz := coalesce(p_expires_at, now() + interval '14 days');
  v_invite public.club_invites;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_owner(p_club_id) then
    raise exception 'only club owners can create invite links';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_club_id::text));

  if v_expires_at <= now() then
    raise exception 'invite expiry must be in the future';
  end if;

  update public.club_invites
  set status = 'revoked'
  where club_id = p_club_id
    and status = 'pending';

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.club_invites (
    club_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_club_id,
    v_token_hash,
    v_user_id,
    v_expires_at
  )
  returning * into v_invite;

  id := v_invite.id;
  token := v_token;
  expires_at := v_invite.expires_at;
  created_at := v_invite.created_at;
  return next;
end;
$$;

create or replace function public.revoke_invite_link(p_invite_id uuid)
returns public.club_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.club_invites;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select *
  into v_invite
  from public.club_invites
  where id = p_invite_id
  for update;

  if v_invite.id is null then
    raise exception 'invite not found';
  end if;

  if not private.is_club_owner(v_invite.club_id) then
    raise exception 'only club owners can revoke invite links';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'only pending invites can be revoked';
  end if;

  update public.club_invites
  set status = 'revoked'
  where id = p_invite_id
  returning * into v_invite;

  return v_invite;
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
  v_invite public.club_invites;
  v_membership public.club_members;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'profile required before accepting an invite';
  end if;

  v_token_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  select *
  into v_invite
  from public.club_invites
  where token_hash = v_token_hash
  for update;

  if v_invite.id is null then
    raise exception 'invite not found';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'invite is no longer pending';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite has expired';
  end if;

  if exists (
    select 1
    from public.club_members
    where club_id = v_invite.club_id
      and user_id = v_user_id
  ) then
    raise exception 'already a member of this club';
  end if;

  insert into public.club_members (club_id, user_id, role)
  values (v_invite.club_id, v_user_id, 'member')
  returning * into v_membership;

  update public.club_invites
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now()
  where id = v_invite.id;

  return v_membership;
end;
$$;

create or replace function public.schedule_arxiv_paper(
  p_club_id uuid,
  p_week_start date,
  p_arxiv_metadata jsonb,
  p_notes text default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_arxiv_id text := regexp_replace(
    nullif(btrim(p_arxiv_metadata ->> 'arxiv_id'), ''),
    'v[0-9]+$',
    ''
  );
  v_title text := nullif(btrim(p_arxiv_metadata ->> 'title'), '');
  v_authors jsonb := coalesce(p_arxiv_metadata -> 'authors', '[]'::jsonb);
  v_abstract_url text := nullif(btrim(p_arxiv_metadata ->> 'abstract_url'), '');
  v_pdf_url text := nullif(btrim(p_arxiv_metadata ->> 'pdf_url'), '');
  v_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  if v_title is null or v_arxiv_id is null then
    raise exception 'arxiv metadata requires title and arxiv_id';
  end if;

  if jsonb_typeof(v_authors) is distinct from 'array' then
    raise exception 'authors must be a JSON array';
  end if;

  if v_arxiv_id !~ '^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+/[0-9]{7})$' then
    raise exception 'arxiv_id is not canonical';
  end if;

  if v_abstract_url <> 'https://arxiv.org/abs/' || v_arxiv_id
    or v_pdf_url <> 'https://arxiv.org/pdf/' || v_arxiv_id then
    raise exception 'arxiv links must match the canonical arxiv_id and point directly to arxiv.org';
  end if;

  insert into public.papers (
    source_type,
    title,
    authors,
    abstract,
    doi,
    license,
    arxiv_id,
    abstract_url,
    pdf_url,
    published_at,
    source_updated_at
  )
  values (
    'arxiv',
    v_title,
    v_authors,
    nullif(btrim(p_arxiv_metadata ->> 'abstract'), ''),
    nullif(btrim(p_arxiv_metadata ->> 'doi'), ''),
    nullif(btrim(p_arxiv_metadata ->> 'license'), ''),
    v_arxiv_id,
    v_abstract_url,
    v_pdf_url,
    nullif(btrim(p_arxiv_metadata ->> 'published_at'), '')::timestamptz,
    nullif(btrim(p_arxiv_metadata ->> 'updated_at'), '')::timestamptz
  )
  on conflict (arxiv_id) where arxiv_id is not null
  do update set
    title = excluded.title,
    authors = excluded.authors,
    abstract = excluded.abstract,
    doi = excluded.doi,
    license = excluded.license,
    abstract_url = excluded.abstract_url,
    pdf_url = excluded.pdf_url,
    published_at = coalesce(public.papers.published_at, excluded.published_at),
    source_updated_at = excluded.source_updated_at,
    updated_at = now()
  returning id into v_paper_id;

  insert into public.club_paper_schedule (
    club_id,
    paper_id,
    week_start,
    notes,
    created_by
  )
  values (
    p_club_id,
    v_paper_id,
    p_week_start,
    nullif(btrim(p_notes), ''),
    v_user_id
  )
  on conflict on constraint club_paper_schedule_club_week_unique
  do update set
    paper_id = excluded.paper_id,
    notes = excluded.notes
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.schedule_manual_paper(
  p_club_id uuid,
  p_week_start date,
  p_metadata jsonb,
  p_notes text default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := nullif(btrim(p_metadata ->> 'title'), '');
  v_external_url text := nullif(btrim(p_metadata ->> 'external_url'), '');
  v_authors jsonb := coalesce(p_metadata -> 'authors', '[]'::jsonb);
  v_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  if v_title is null or v_external_url is null then
    raise exception 'manual metadata requires title and external_url';
  end if;

  if jsonb_typeof(v_authors) is distinct from 'array' then
    raise exception 'authors must be a JSON array';
  end if;

  insert into public.papers (
    source_type,
    title,
    authors,
    abstract,
    doi,
    license,
    external_url
  )
  values (
    'manual',
    v_title,
    v_authors,
    nullif(btrim(p_metadata ->> 'abstract'), ''),
    nullif(btrim(p_metadata ->> 'doi'), ''),
    nullif(btrim(p_metadata ->> 'license'), ''),
    v_external_url
  )
  returning id into v_paper_id;

  insert into public.club_paper_schedule (
    club_id,
    paper_id,
    week_start,
    notes,
    created_by
  )
  values (
    p_club_id,
    v_paper_id,
    p_week_start,
    nullif(btrim(p_notes), ''),
    v_user_id
  )
  on conflict on constraint club_paper_schedule_club_week_unique
  do update set
    paper_id = excluded.paper_id,
    notes = excluded.notes
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.toggle_read_status(
  p_schedule_id uuid,
  p_read boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_schedule_member(p_schedule_id) then
    raise exception 'only club members can update read status';
  end if;

  if p_read then
    insert into public.reading_logs (schedule_id, user_id)
    values (p_schedule_id, v_user_id)
    on conflict on constraint reading_logs_schedule_user_unique
    do update set read_at = now();
  else
    delete from public.reading_logs
    where schedule_id = p_schedule_id
      and user_id = v_user_id;
  end if;

  return p_read;
end;
$$;

create or replace function public.get_club_schedule_progress(p_club_id uuid)
returns table (
  schedule_id uuid,
  total_members bigint,
  read_count bigint,
  current_user_read boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cps.id as schedule_id,
    count(cm.user_id)::bigint as total_members,
    count(rl.user_id)::bigint as read_count,
    exists (
      select 1
      from public.reading_logs mine
      where mine.schedule_id = cps.id
        and mine.user_id = (select auth.uid())
    ) as current_user_read
  from public.club_paper_schedule cps
  join public.club_members cm on cm.club_id = cps.club_id
  left join public.reading_logs rl
    on rl.schedule_id = cps.id
    and rl.user_id = cm.user_id
  where cps.club_id = p_club_id
    and private.is_club_member(p_club_id)
  group by cps.id;
$$;

revoke all on schema public from public, anon, authenticated;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name, avatar_url, bio) on public.profiles to authenticated;
grant update (display_name, avatar_url, bio) on public.profiles to authenticated;
grant select on public.clubs to authenticated;
grant update (name, slug, description) on public.clubs to authenticated;
grant select on public.club_members to authenticated;
grant insert (club_id, user_id, role) on public.club_members to authenticated;
grant update (role) on public.club_members to authenticated;
grant delete on public.club_members to authenticated;
grant select on public.club_invites to authenticated;
grant select on public.papers to authenticated;
grant select, delete on public.club_paper_schedule to authenticated;
grant select on public.reading_logs to authenticated;
grant select on public.comments to authenticated;
grant insert (schedule_id, author_id, body) on public.comments to authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
grant usage on all sequences in schema public to authenticated;

revoke all on all functions in schema private from public;
revoke execute on function private.is_club_member(uuid) from public, anon, authenticated;
revoke execute on function private.is_club_owner(uuid) from public, anon, authenticated;
revoke execute on function private.is_schedule_member(uuid) from public, anon, authenticated;
revoke execute on function private.is_schedule_owner(uuid) from public, anon, authenticated;
revoke execute on function private.shares_club_with(uuid) from public, anon, authenticated;
grant execute on function private.is_club_member(uuid) to authenticated;
grant execute on function private.is_club_owner(uuid) to authenticated;
grant execute on function private.is_schedule_member(uuid) to authenticated;
grant execute on function private.is_schedule_owner(uuid) to authenticated;
grant execute on function private.shares_club_with(uuid) to authenticated;

revoke all on function public.create_club(text, text, text) from public;
revoke all on function public.create_invite_link(uuid, timestamptz) from public;
revoke all on function public.revoke_invite_link(uuid) from public;
revoke all on function public.accept_invite(text) from public;
revoke all on function public.schedule_arxiv_paper(uuid, date, jsonb, text) from public;
revoke all on function public.schedule_manual_paper(uuid, date, jsonb, text) from public;
revoke all on function public.toggle_read_status(uuid, boolean) from public;
revoke all on function public.get_club_schedule_progress(uuid) from public;

grant execute on function public.create_club(text, text, text) to authenticated;
grant execute on function public.create_invite_link(uuid, timestamptz) to authenticated;
grant execute on function public.revoke_invite_link(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.schedule_arxiv_paper(uuid, date, jsonb, text) to authenticated;
grant execute on function public.schedule_manual_paper(uuid, date, jsonb, text) to authenticated;
grant execute on function public.toggle_read_status(uuid, boolean) to authenticated;
grant execute on function public.get_club_schedule_progress(uuid) to authenticated;
