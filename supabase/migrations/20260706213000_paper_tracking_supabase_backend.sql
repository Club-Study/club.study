do $$
begin
  create type public.paper_status as enum (
    'planned',
    'reading',
    'on_hold',
    'dropped',
    'read'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.papers
  add column if not exists page_count integer
    check (page_count is null or page_count > 0);

alter table public.club_paper_schedule
  drop constraint if exists club_paper_schedule_club_week_unique,
  drop constraint if exists club_paper_schedule_week_start_monday_check,
  alter column week_start drop not null;

create table public.personal_papers (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  read_at timestamptz,
  deadline date,
  status public.paper_status not null default 'planned',
  created_at timestamptz not null default now(),
  constraint pers_paper_user_paper_unique unique (user_id, paper_id)
);

create table public.schedule_paper_statuses (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_id uuid not null references public.club_paper_schedule (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.paper_status not null default 'planned',
  read_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint sched_paper_status_unique unique (schedule_id, user_id)
);

create table public.reading_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_id uuid references public.club_paper_schedule (id) on delete cascade,
  personal_paper_id uuid references public.personal_papers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pages_read integer not null check (pages_read > 0),
  logged_at timestamptz not null default now(),
  constraint read_sess_one_context_chk check (
    (
      schedule_id is not null
      and personal_paper_id is null
    )
    or (
      schedule_id is null
      and personal_paper_id is not null
    )
  )
);

create index pers_paper_user_created_idx
on public.personal_papers (user_id, created_at);

create index pers_paper_user_read_idx
on public.personal_papers (user_id, read_at);

create index pers_paper_user_deadline_idx
on public.personal_papers (user_id, deadline);

create index pers_paper_user_status_idx
on public.personal_papers (user_id, status);

create index pers_paper_paper_idx
on public.personal_papers (paper_id);

create index sched_status_user_idx
on public.schedule_paper_statuses (user_id, status);

create index sched_status_sched_idx
on public.schedule_paper_statuses (schedule_id, status);

create index read_sess_user_logged_idx
on public.reading_sessions (user_id, logged_at);

create index read_sess_schedule_idx
on public.reading_sessions (schedule_id);

create index read_sess_personal_idx
on public.reading_sessions (personal_paper_id);

create trigger schedule_paper_statuses_set_updated_at
before update on public.schedule_paper_statuses
for each row execute function public.set_updated_at();

create or replace function private.is_personal_paper_owner(p_personal_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personal_papers pp
    where pp.id = p_personal_paper_id
      and pp.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_access_paper(p_paper_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.personal_papers pp
    where pp.paper_id = p_paper_id
      and pp.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.club_paper_schedule cps
    join public.club_members cm on cm.club_id = cps.club_id
    where cps.paper_id = p_paper_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.upsert_arxiv_paper(p_arxiv_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_arxiv_metadata ->> 'title'), '');
  v_arxiv_id text := regexp_replace(
    nullif(btrim(p_arxiv_metadata ->> 'arxiv_id'), ''),
    'v[0-9]+$',
    ''
  );
  v_abstract_url text := nullif(btrim(p_arxiv_metadata ->> 'abstract_url'), '');
  v_pdf_url text := nullif(btrim(p_arxiv_metadata ->> 'pdf_url'), '');
  v_authors jsonb := coalesce(p_arxiv_metadata -> 'authors', '[]'::jsonb);
  v_paper_id uuid;
begin
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

  return v_paper_id;
end;
$$;

create or replace function private.create_manual_paper(p_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_metadata ->> 'title'), '');
  v_external_url text := nullif(btrim(p_metadata ->> 'external_url'), '');
  v_authors jsonb := coalesce(p_metadata -> 'authors', '[]'::jsonb);
  v_paper_id uuid;
begin
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

  return v_paper_id;
end;
$$;

create or replace function private.apply_schedule_status(
  p_schedule_id uuid,
  p_user_id uuid,
  p_status public.paper_status
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reading_log_id uuid;
begin
  insert into public.schedule_paper_statuses (
    schedule_id,
    user_id,
    status,
    read_at
  )
  values (
    p_schedule_id,
    p_user_id,
    p_status,
    case when p_status = 'read' then now() else null end
  )
  on conflict on constraint sched_paper_status_unique
  do update set
    status = excluded.status,
    read_at = case
      when excluded.status = 'read'
        then coalesce(public.schedule_paper_statuses.read_at, now())
      else null
    end
  returning (
    select rl.id
    from public.reading_logs rl
    where rl.schedule_id = p_schedule_id
      and rl.user_id = p_user_id
  ) into v_reading_log_id;

  if p_status = 'read' then
    insert into public.reading_logs (schedule_id, user_id)
    values (p_schedule_id, p_user_id)
    on conflict on constraint reading_logs_schedule_user_unique
    do nothing;

    select rl.id
    into v_reading_log_id
    from public.reading_logs rl
    where rl.schedule_id = p_schedule_id
      and rl.user_id = p_user_id;
  else
    delete from public.reading_logs
    where schedule_id = p_schedule_id
      and user_id = p_user_id;

    v_reading_log_id := null;
  end if;

  return v_reading_log_id;
end;
$$;

drop policy if exists "papers select scheduled club papers"
on public.papers;

create policy "papers select visible papers"
on public.papers
for select
to authenticated
using (private.can_access_paper(id));

alter table public.personal_papers enable row level security;
alter table public.schedule_paper_statuses enable row level security;
alter table public.reading_sessions enable row level security;

create policy "personal papers select own"
on public.personal_papers
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "personal papers update own"
on public.personal_papers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "schedule paper statuses select own"
on public.schedule_paper_statuses
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "reading sessions select own"
on public.reading_sessions
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.schedule_arxiv_paper(
  p_club_id uuid,
  p_week_start date default null,
  p_arxiv_metadata jsonb default '{}'::jsonb,
  p_notes text default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  v_paper_id := private.upsert_arxiv_paper(p_arxiv_metadata);

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
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.schedule_manual_paper(
  p_club_id uuid,
  p_week_start date default null,
  p_metadata jsonb default '{}'::jsonb,
  p_notes text default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  v_paper_id := private.create_manual_paper(p_metadata);

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
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.schedule_existing_paper(
  p_club_id uuid,
  p_paper_id uuid,
  p_week_start date default null,
  p_notes text default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  if not private.can_access_paper(p_paper_id) then
    raise exception 'paper is not in your profile lists';
  end if;

  insert into public.club_paper_schedule (
    club_id,
    paper_id,
    week_start,
    notes,
    created_by
  )
  values (
    p_club_id,
    p_paper_id,
    p_week_start,
    nullif(btrim(p_notes), ''),
    v_user_id
  )
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.add_personal_arxiv_paper(
  p_arxiv_metadata jsonb,
  p_deadline date default null
)
returns public.personal_papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper_id uuid;
  v_personal_paper public.personal_papers;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  v_paper_id := private.upsert_arxiv_paper(p_arxiv_metadata);

  insert into public.personal_papers (user_id, paper_id, deadline)
  values (v_user_id, v_paper_id, p_deadline)
  on conflict on constraint pers_paper_user_paper_unique
  do update set
    deadline = coalesce(excluded.deadline, public.personal_papers.deadline)
  returning * into v_personal_paper;

  return v_personal_paper;
end;
$$;

create or replace function public.add_personal_manual_paper(
  p_metadata jsonb,
  p_deadline date default null
)
returns public.personal_papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper_id uuid;
  v_personal_paper public.personal_papers;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  v_paper_id := private.create_manual_paper(p_metadata);

  insert into public.personal_papers (user_id, paper_id, deadline)
  values (v_user_id, v_paper_id, p_deadline)
  returning * into v_personal_paper;

  return v_personal_paper;
end;
$$;

create or replace function public.set_schedule_paper_status(
  p_schedule_id uuid,
  p_status public.paper_status
)
returns table (
  schedule_id uuid,
  status public.paper_status,
  read boolean,
  reading_log_id uuid
)
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
    raise exception 'only club members can update paper status';
  end if;

  reading_log_id := private.apply_schedule_status(
    p_schedule_id,
    v_user_id,
    p_status
  );
  schedule_id := p_schedule_id;
  status := p_status;
  read := p_status = 'read';
  return next;
end;
$$;

drop function if exists public.toggle_read_status(uuid, boolean);

create or replace function public.toggle_read_status(
  p_schedule_id uuid,
  p_read boolean
)
returns table (
  schedule_id uuid,
  status public.paper_status,
  read boolean,
  reading_log_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_next_status public.paper_status;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_schedule_member(p_schedule_id) then
    raise exception 'only club members can update read status';
  end if;

  if p_read then
    v_next_status := 'read';
  else
    v_next_status := case
      when exists (
        select 1
        from public.reading_sessions rs
        where rs.schedule_id = p_schedule_id
          and rs.user_id = v_user_id
      ) then 'reading'::public.paper_status
      else 'planned'::public.paper_status
    end;
  end if;

  reading_log_id := private.apply_schedule_status(
    p_schedule_id,
    v_user_id,
    v_next_status
  );
  schedule_id := p_schedule_id;
  status := v_next_status;
  read := v_next_status = 'read';
  return next;
end;
$$;

create or replace function public.set_personal_paper_status(
  p_personal_paper_id uuid,
  p_status public.paper_status
)
returns public.personal_papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_personal_paper public.personal_papers;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  update public.personal_papers
  set
    status = p_status,
    read_at = case
      when p_status = 'read' then coalesce(read_at, now())
      else null
    end
  where id = p_personal_paper_id
    and user_id = v_user_id
  returning * into v_personal_paper;

  if v_personal_paper.id is null then
    raise exception 'personal paper not found';
  end if;

  return v_personal_paper;
end;
$$;

create or replace function public.toggle_personal_paper_read_status(
  p_personal_paper_id uuid,
  p_read boolean
)
returns public.personal_papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_next_status public.paper_status;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_personal_paper_owner(p_personal_paper_id) then
    raise exception 'personal paper not found';
  end if;

  if p_read then
    v_next_status := 'read';
  else
    v_next_status := case
      when exists (
        select 1
        from public.reading_sessions rs
        where rs.personal_paper_id = p_personal_paper_id
          and rs.user_id = v_user_id
      ) then 'reading'::public.paper_status
      else 'planned'::public.paper_status
    end;
  end if;

  return public.set_personal_paper_status(p_personal_paper_id, v_next_status);
end;
$$;

create or replace function public.log_schedule_reading_session(
  p_schedule_id uuid,
  p_pages_read integer
)
returns public.reading_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.reading_sessions;
  v_current_status public.paper_status;
  v_page_count integer;
  v_pages_read integer;
  v_next_status public.paper_status;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_pages_read is null or p_pages_read < 1 then
    raise exception 'pages_read must be a positive integer';
  end if;

  if not private.is_schedule_member(p_schedule_id) then
    raise exception 'only club members can log schedule reading sessions';
  end if;

  insert into public.reading_sessions (schedule_id, user_id, pages_read)
  values (p_schedule_id, v_user_id, p_pages_read)
  returning * into v_session;

  select sps.status
  into v_current_status
  from public.schedule_paper_statuses sps
  where sps.schedule_id = p_schedule_id
    and sps.user_id = v_user_id;

  if v_current_status is distinct from 'read' then
    select p.page_count, coalesce(sum(rs.pages_read), 0)::integer
    into v_page_count, v_pages_read
    from public.club_paper_schedule cps
    join public.papers p on p.id = cps.paper_id
    left join public.reading_sessions rs
      on rs.schedule_id = cps.id
      and rs.user_id = v_user_id
    where cps.id = p_schedule_id
    group by p.page_count;

    v_next_status := case
      when v_page_count is not null and v_pages_read >= v_page_count
        then 'read'::public.paper_status
      else 'reading'::public.paper_status
    end;

    perform private.apply_schedule_status(
      p_schedule_id,
      v_user_id,
      v_next_status
    );
  end if;

  return v_session;
end;
$$;

create or replace function public.log_personal_paper_reading_session(
  p_personal_paper_id uuid,
  p_pages_read integer
)
returns public.reading_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.reading_sessions;
  v_current_status public.paper_status;
  v_page_count integer;
  v_pages_read integer;
  v_next_status public.paper_status;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_pages_read is null or p_pages_read < 1 then
    raise exception 'pages_read must be a positive integer';
  end if;

  if not private.is_personal_paper_owner(p_personal_paper_id) then
    raise exception 'personal paper not found';
  end if;

  insert into public.reading_sessions (
    personal_paper_id,
    user_id,
    pages_read
  )
  values (p_personal_paper_id, v_user_id, p_pages_read)
  returning * into v_session;

  select pp.status, p.page_count, coalesce(sum(rs.pages_read), 0)::integer
  into v_current_status, v_page_count, v_pages_read
  from public.personal_papers pp
  join public.papers p on p.id = pp.paper_id
  left join public.reading_sessions rs
    on rs.personal_paper_id = pp.id
    and rs.user_id = v_user_id
  where pp.id = p_personal_paper_id
    and pp.user_id = v_user_id
  group by pp.status, p.page_count;

  if v_current_status is distinct from 'read' then
    v_next_status := case
      when v_page_count is not null and v_pages_read >= v_page_count
        then 'read'::public.paper_status
      else 'reading'::public.paper_status
    end;

    perform public.set_personal_paper_status(
      p_personal_paper_id,
      v_next_status
    );
  end if;

  return v_session;
end;
$$;

create or replace function public.update_paper_page_count(
  p_paper_id uuid,
  p_page_count integer
)
returns public.papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_paper public.papers;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_page_count is null or p_page_count < 1 then
    raise exception 'page_count must be a positive integer';
  end if;

  if not private.can_access_paper(p_paper_id) then
    raise exception 'paper is not in your profile lists';
  end if;

  update public.papers
  set page_count = p_page_count
  where id = p_paper_id
  returning * into v_paper;

  if v_paper.id is null then
    raise exception 'paper not found';
  end if;

  return v_paper;
end;
$$;

drop function if exists public.get_club_schedule_progress(uuid);

create or replace function public.get_club_schedule_progress(p_club_id uuid)
returns table (
  schedule_id uuid,
  total_members bigint,
  read_count bigint,
  current_user_read boolean,
  current_user_status public.paper_status,
  current_user_pages_read bigint,
  current_user_session_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cps.id as schedule_id,
    count(cm.user_id)::bigint as total_members,
    count(sps_read.user_id)::bigint as read_count,
    coalesce(current_status.status, 'planned'::public.paper_status) = 'read'
      as current_user_read,
    coalesce(current_status.status, 'planned'::public.paper_status)
      as current_user_status,
    coalesce(current_sessions.pages_read, 0)::bigint
      as current_user_pages_read,
    coalesce(current_sessions.session_count, 0)::bigint
      as current_user_session_count
  from public.club_paper_schedule cps
  join public.club_members cm on cm.club_id = cps.club_id
  left join public.schedule_paper_statuses sps_read
    on sps_read.schedule_id = cps.id
    and sps_read.user_id = cm.user_id
    and sps_read.status = 'read'
  left join public.schedule_paper_statuses current_status
    on current_status.schedule_id = cps.id
    and current_status.user_id = (select auth.uid())
  left join (
    select
      rs.schedule_id,
      sum(rs.pages_read)::bigint as pages_read,
      count(rs.id)::bigint as session_count
    from public.reading_sessions rs
    where rs.user_id = (select auth.uid())
    group by rs.schedule_id
  ) current_sessions on current_sessions.schedule_id = cps.id
  where cps.club_id = p_club_id
    and private.is_club_member(p_club_id)
  group by
    cps.id,
    current_status.status,
    current_sessions.pages_read,
    current_sessions.session_count;
$$;

grant select on public.personal_papers to authenticated;
grant select on public.schedule_paper_statuses to authenticated;
grant select on public.reading_sessions to authenticated;

revoke all on function private.is_personal_paper_owner(uuid) from public, anon, authenticated;
revoke all on function private.can_access_paper(uuid) from public, anon, authenticated;
revoke all on function private.upsert_arxiv_paper(jsonb) from public, anon, authenticated;
revoke all on function private.create_manual_paper(jsonb) from public, anon, authenticated;
revoke all on function private.apply_schedule_status(uuid, uuid, public.paper_status) from public, anon, authenticated;

grant execute on function private.is_personal_paper_owner(uuid) to authenticated;
grant execute on function private.can_access_paper(uuid) to authenticated;

revoke all on function public.schedule_arxiv_paper(uuid, date, jsonb, text) from public;
revoke all on function public.schedule_manual_paper(uuid, date, jsonb, text) from public;
revoke all on function public.schedule_existing_paper(uuid, uuid, date, text) from public;
revoke all on function public.add_personal_arxiv_paper(jsonb, date) from public;
revoke all on function public.add_personal_manual_paper(jsonb, date) from public;
revoke all on function public.set_schedule_paper_status(uuid, public.paper_status) from public;
revoke all on function public.toggle_read_status(uuid, boolean) from public;
revoke all on function public.set_personal_paper_status(uuid, public.paper_status) from public;
revoke all on function public.toggle_personal_paper_read_status(uuid, boolean) from public;
revoke all on function public.log_schedule_reading_session(uuid, integer) from public;
revoke all on function public.log_personal_paper_reading_session(uuid, integer) from public;
revoke all on function public.update_paper_page_count(uuid, integer) from public;
revoke all on function public.get_club_schedule_progress(uuid) from public;

grant execute on function public.schedule_arxiv_paper(uuid, date, jsonb, text) to authenticated;
grant execute on function public.schedule_manual_paper(uuid, date, jsonb, text) to authenticated;
grant execute on function public.schedule_existing_paper(uuid, uuid, date, text) to authenticated;
grant execute on function public.add_personal_arxiv_paper(jsonb, date) to authenticated;
grant execute on function public.add_personal_manual_paper(jsonb, date) to authenticated;
grant execute on function public.set_schedule_paper_status(uuid, public.paper_status) to authenticated;
grant execute on function public.toggle_read_status(uuid, boolean) to authenticated;
grant execute on function public.set_personal_paper_status(uuid, public.paper_status) to authenticated;
grant execute on function public.toggle_personal_paper_read_status(uuid, boolean) to authenticated;
grant execute on function public.log_schedule_reading_session(uuid, integer) to authenticated;
grant execute on function public.log_personal_paper_reading_session(uuid, integer) to authenticated;
grant execute on function public.update_paper_page_count(uuid, integer) to authenticated;
grant execute on function public.get_club_schedule_progress(uuid) to authenticated;
