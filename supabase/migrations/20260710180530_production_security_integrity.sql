-- Production hardening for database privileges, privacy, and content identity.

create or replace function private.paper_authors_are_valid(p_authors jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_author jsonb;
  v_author_text text;
begin
  if p_authors is null
    or pg_catalog.jsonb_typeof(p_authors) <> 'array'
    or pg_catalog.jsonb_array_length(p_authors) > 100 then
    return false;
  end if;

  for v_author in
    select value
    from pg_catalog.jsonb_array_elements(p_authors)
  loop
    if pg_catalog.jsonb_typeof(v_author) <> 'string' then
      return false;
    end if;

    v_author_text := v_author #>> '{}';
    if pg_catalog.char_length(pg_catalog.btrim(v_author_text)) not between 1 and 300 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function private.paper_authors_are_valid(jsonb)
from public, anon, authenticated, service_role;

create or replace function private.normalize_manual_url(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_url text := pg_catalog.btrim(p_url);
  v_parts text[];
  v_scheme text;
  v_authority text;
  v_authority_parts text[];
  v_host text;
  v_port_text text;
  v_port integer;
  v_suffix text;
  v_path text;
begin
  if v_url is null
    or pg_catalog.char_length(v_url) not between 8 and 2048
    or v_url ~ '[[:space:][:cntrl:]]' then
    return null;
  end if;

  v_parts := pg_catalog.regexp_match(
    v_url,
    '^(https?)://([^/?#]+)(.*)$',
    'i'
  );

  if v_parts is null then
    return null;
  end if;

  v_scheme := pg_catalog.lower(v_parts[1]);
  v_authority := v_parts[2];

  if v_authority = '' or pg_catalog.strpos(v_authority, '@') > 0 then
    return null;
  end if;

  if pg_catalog.left(v_authority, 1) = '[' then
    v_authority_parts := pg_catalog.regexp_match(
      v_authority,
      '^\[([0-9A-Fa-f:.]+)\](:([0-9]{1,5}))?$'
    );

    if v_authority_parts is null then
      return null;
    end if;

    begin
      v_host := '[' || pg_catalog.lower(
        pg_catalog.host(v_authority_parts[1]::pg_catalog.inet)
      ) || ']';
    exception when invalid_text_representation then
      return null;
    end;
  else
    v_authority_parts := pg_catalog.regexp_match(
      v_authority,
      '^([A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]|[A-Za-z0-9])(:([0-9]{1,5}))?$',
      'i'
    );

    if v_authority_parts is null or v_authority_parts[1] ~ '\.\.' then
      return null;
    end if;

    v_host := pg_catalog.lower(v_authority_parts[1]);
    if v_host ~ '^[0-9.]+$' then
      begin
        v_host := pg_catalog.host(v_host::pg_catalog.inet);
      exception when invalid_text_representation then
        return null;
      end;
    end if;
  end if;

  v_port_text := v_authority_parts[3];
  if v_port_text is not null then
    v_port := v_port_text::integer;
    if v_port not between 1 and 65535 then
      return null;
    end if;

    if (v_scheme = 'http' and v_port = 80)
      or (v_scheme = 'https' and v_port = 443) then
      v_port_text := null;
    else
      v_port_text := v_port::text;
    end if;
  end if;

  v_suffix := pg_catalog.split_part(v_parts[3], '#', 1);
  if v_suffix = '' then
    v_suffix := '/';
  elsif pg_catalog.left(v_suffix, 1) = '?' then
    v_suffix := '/' || v_suffix;
  end if;

  v_path := pg_catalog.split_part(v_suffix, '?', 1);
  if pg_catalog.lower(v_path) ~ '(^|/)(\.|%2e)(\.|%2e)?(/|$)' then
    return null;
  end if;

  return v_scheme || '://' || v_host ||
    case when v_port_text is null then '' else ':' || v_port_text end ||
    v_suffix;
end;
$$;

revoke all on function private.normalize_manual_url(text)
from public, anon, authenticated, service_role;

update public.papers
set external_url = private.normalize_manual_url(external_url)
where source_type = 'manual'::public.paper_source_type
  and external_url is not null
  and private.normalize_manual_url(external_url) is not null
  and external_url is distinct from private.normalize_manual_url(external_url);

alter table public.papers
  add column manual_scope text;

update public.papers p
set manual_scope = coalesce(
  (
    select 'user:' || pp.user_id::text
    from public.personal_papers pp
    where pp.paper_id = p.id
    order by pp.created_at, pp.id
    limit 1
  ),
  (
    select 'club:' || cps.club_id::text
    from public.club_paper_schedule cps
    where cps.paper_id = p.id
    order by cps.created_at, cps.id
    limit 1
  ),
  'legacy:' || p.id::text
)
where p.source_type = 'manual'::public.paper_source_type;

do $$
begin
  if exists (
    select 1
    from public.clubs
    group by pg_catalog.lower(pg_catalog.btrim(name))
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'duplicate normalized club names must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers
    where source_type = 'manual'::public.paper_source_type
      and private.normalize_manual_url(external_url) is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'invalid manual paper URLs must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers
    where not private.paper_authors_are_valid(authors)
  ) then
    raise exception using
      errcode = '23514',
      message = 'invalid or unbounded paper authors must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers
    where (abstract is not null and pg_catalog.char_length(abstract) > 100000)
      or (doi is not null and pg_catalog.char_length(pg_catalog.btrim(doi)) not between 1 and 512)
      or (license is not null and pg_catalog.char_length(pg_catalog.btrim(license)) not between 1 and 2000)
      or (abstract_url is not null and pg_catalog.char_length(abstract_url) > 2048)
      or (pdf_url is not null and pg_catalog.char_length(pdf_url) > 2048)
      or (external_url is not null and pg_catalog.char_length(external_url) > 2048)
  ) then
    raise exception using
      errcode = '23514',
      message = 'unbounded paper metadata must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers
    where page_count is not null
      and page_count not between 1 and 100000
  ) then
    raise exception using
      errcode = '23514',
      message = 'paper page counts outside 1..100000 must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.reading_sessions
    where pages_read not between 1 and 100000
  ) then
    raise exception using
      errcode = '23514',
      message = 'reading session deltas outside 1..100000 must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.reading_sessions
    group by user_id, schedule_id, personal_paper_id
    having pg_catalog.sum(pages_read) > 100000
  ) then
    raise exception using
      errcode = '23514',
      message = 'reading progress totals above 100000 must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.personal_papers pp
    join public.papers p on p.id = pp.paper_id
    where p.source_type = 'manual'::public.paper_source_type
    group by pp.paper_id
    having pg_catalog.count(distinct pp.user_id) > 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'cross-user manual paper references must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers p
    where p.source_type = 'manual'::public.paper_source_type
      and exists (
        select 1 from public.personal_papers pp where pp.paper_id = p.id
      )
      and exists (
        select 1 from public.club_paper_schedule cps where cps.paper_id = p.id
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'mixed personal and club manual paper references must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.club_paper_schedule cps
    join public.papers p on p.id = cps.paper_id
    where p.source_type = 'manual'::public.paper_source_type
    group by cps.paper_id
    having pg_catalog.count(distinct cps.club_id) > 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'cross-club manual paper references must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.papers
    where source_type = 'manual'::public.paper_source_type
    group by manual_scope, private.normalize_manual_url(external_url)
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'duplicate manual paper URLs within one scope must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.club_paper_schedule
    group by club_id, paper_id, week_start
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'duplicate exact scheduled papers must be resolved before this migration';
  end if;

  if exists (
    select 1
    from public.paper_annotations pa
    join public.club_paper_schedule cps on cps.id = pa.schedule_id
    where pa.paper_id <> cps.paper_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'annotation schedule/paper mismatches must be resolved before this migration';
  end if;
end;
$$;

alter table public.papers
  drop constraint if exists papers_page_count_check,
  add constraint papers_page_count_check
    check (page_count is null or page_count between 1 and 100000),
  add constraint papers_authors_bounded_check
    check (private.paper_authors_are_valid(authors)),
  add constraint papers_abstract_length_check
    check (abstract is null or pg_catalog.char_length(abstract) <= 100000),
  add constraint papers_doi_length_check
    check (
      doi is null
      or pg_catalog.char_length(pg_catalog.btrim(doi)) between 1 and 512
    ),
  add constraint papers_license_length_check
    check (
      license is null
      or pg_catalog.char_length(pg_catalog.btrim(license)) between 1 and 2000
    ),
  add constraint papers_url_length_check
    check (
      (abstract_url is null or pg_catalog.char_length(abstract_url) <= 2048)
      and (pdf_url is null or pg_catalog.char_length(pdf_url) <= 2048)
      and (external_url is null or pg_catalog.char_length(external_url) <= 2048)
    ),
  add constraint papers_manual_external_url_check
    check (
      source_type <> 'manual'::public.paper_source_type
      or (
        private.normalize_manual_url(external_url) is not null
        and external_url = private.normalize_manual_url(external_url)
      )
    ),
  add constraint papers_manual_scope_check
    check (
      (
        source_type = 'manual'::public.paper_source_type
        and manual_scope ~ '^(user|club|legacy):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      or (
        source_type = 'arxiv'::public.paper_source_type
        and manual_scope is null
      )
    );

create unique index clubs_name_normalized_unique_idx
on public.clubs (pg_catalog.lower(pg_catalog.btrim(name)));

create unique index papers_manual_external_url_unique_idx
on public.papers (manual_scope, private.normalize_manual_url(external_url))
where source_type = 'manual'::public.paper_source_type;

create unique index club_paper_schedule_exact_unique_idx
on public.club_paper_schedule (club_id, paper_id, week_start)
nulls not distinct;

alter table public.club_paper_schedule
  add constraint club_paper_schedule_id_paper_unique unique (id, paper_id),
  add column page_count integer
    check (page_count is null or page_count between 1 and 100000);

alter table public.personal_papers
  add column page_count integer
    check (page_count is null or page_count between 1 and 100000);

alter table public.reading_sessions
  add constraint reading_sessions_pages_read_bounded_check
    check (pages_read between 1 and 100000);

update public.club_paper_schedule cps
set page_count = p.page_count
from public.papers p
where p.id = cps.paper_id
  and p.page_count is not null
  and p.page_count >= coalesce(
    (
      select pg_catalog.max(user_pages)
      from (
        select pg_catalog.sum(rs.pages_read) as user_pages
        from public.reading_sessions rs
        where rs.schedule_id = cps.id
        group by rs.user_id
      ) progress_by_user
    ),
    0
  );

update public.personal_papers pp
set page_count = p.page_count
from public.papers p
where p.id = pp.paper_id
  and p.page_count is not null
  and p.page_count >= coalesce(
    (
      select pg_catalog.sum(rs.pages_read)
      from public.reading_sessions rs
      where rs.personal_paper_id = pp.id
        and rs.user_id = pp.user_id
    ),
    0
  );

alter table public.paper_annotations
  add constraint paper_annotations_schedule_paper_fkey
    foreign key (schedule_id, paper_id)
    references public.club_paper_schedule (id, paper_id)
    on delete cascade;

alter table public.paper_annotations
  drop constraint paper_annotations_schedule_id_fkey;

create index paper_annotations_paper_id_idx
on public.paper_annotations (paper_id);

insert into public.schedule_paper_statuses (
  schedule_id,
  user_id,
  status,
  read_at
)
select
  rl.schedule_id,
  rl.user_id,
  'read'::public.paper_status,
  rl.read_at
from public.reading_logs rl
on conflict on constraint sched_paper_status_unique
do update set
  status = 'read'::public.paper_status,
  read_at = case
    when public.schedule_paper_statuses.read_at is null
      then excluded.read_at
    else least(public.schedule_paper_statuses.read_at, excluded.read_at)
  end;

update public.profiles
set is_public = false
where is_public;

alter table public.profiles
  alter column is_public set default false;

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
      and private.can_view_profile_activity(pp.user_id)
  )
  or exists (
    select 1
    from public.club_paper_schedule cps
    join public.club_members cm on cm.club_id = cps.club_id
    where cps.paper_id = p_paper_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_edit_paper(p_paper_id uuid)
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
      and cm.role::text in ('owner', 'admin')
  );
$$;

create or replace function private.is_annotation_member(p_annotation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.paper_annotations pa
    where pa.id = p_annotation_id
      and pa.deleted_at is null
      and private.is_schedule_member(pa.schedule_id)
  );
$$;

create or replace function public.soft_delete_comment(p_comment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment public.comments;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select c.*
  into v_comment
  from public.comments c
  where c.id = p_comment_id
  for update;

  if v_comment.id is null
    or not private.is_schedule_member(v_comment.schedule_id) then
    raise exception 'comment not found';
  end if;

  if v_user_id <> v_comment.author_id
    and not private.is_schedule_manager(v_comment.schedule_id) then
    raise exception 'not authorized to delete comment';
  end if;

  if v_comment.deleted_at is null then
    update public.comments
    set deleted_at = pg_catalog.now()
    where id = v_comment.id;
  end if;

  return v_comment.id;
end;
$$;

create or replace function public.soft_delete_paper_annotation(
  p_annotation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_annotation public.paper_annotations;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select pa.*
  into v_annotation
  from public.paper_annotations pa
  where pa.id = p_annotation_id
  for update;

  if v_annotation.id is null
    or not private.is_schedule_member(v_annotation.schedule_id) then
    raise exception 'annotation not found';
  end if;

  if v_user_id <> v_annotation.author_id
    and not private.is_schedule_manager(v_annotation.schedule_id) then
    raise exception 'not authorized to delete annotation';
  end if;

  if v_annotation.deleted_at is null then
    update public.paper_annotations
    set deleted_at = pg_catalog.now()
    where id = v_annotation.id;
  end if;

  return v_annotation.id;
end;
$$;

create or replace function public.soft_delete_paper_annotation_reply(
  p_reply_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_reply public.paper_annotation_replies;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select par.*
  into v_reply
  from public.paper_annotation_replies par
  where par.id = p_reply_id
  for update;

  if v_reply.id is null
    or not private.is_annotation_member(v_reply.annotation_id) then
    raise exception 'annotation reply not found';
  end if;

  if v_user_id <> v_reply.author_id
    and not private.is_annotation_manager(v_reply.annotation_id) then
    raise exception 'not authorized to delete annotation reply';
  end if;

  if v_reply.deleted_at is null then
    update public.paper_annotation_replies
    set deleted_at = pg_catalog.now()
    where id = v_reply.id;
  end if;

  return v_reply.id;
end;
$$;

drop policy if exists "clubs select members or public activity" on public.clubs;
drop policy if exists "clubs select members" on public.clubs;
create policy "clubs select members"
on public.clubs
for select
to authenticated
using (private.is_club_member(id));

drop policy if exists "club schedule select members or public activity"
on public.club_paper_schedule;
drop policy if exists "club schedule select members"
on public.club_paper_schedule;
create policy "club schedule select members"
on public.club_paper_schedule
for select
to authenticated
using (private.is_club_member(club_id));

drop policy if exists "reading logs select own or public profile"
on public.reading_logs;
drop policy if exists "reading logs select own" on public.reading_logs;
create policy "reading logs select own"
on public.reading_logs
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "schedule paper statuses select own or public profile"
on public.schedule_paper_statuses;
drop policy if exists "schedule paper statuses select own"
on public.schedule_paper_statuses;
create policy "schedule paper statuses select own"
on public.schedule_paper_statuses
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "personal papers select own or public profile"
on public.personal_papers;
drop policy if exists "personal papers select own" on public.personal_papers;
create policy "personal papers select own or public profile"
on public.personal_papers
for select
to authenticated
using (private.can_view_profile_activity(user_id));

drop policy if exists "reading sessions select own or public profile"
on public.reading_sessions;
drop policy if exists "reading sessions select own" on public.reading_sessions;
create policy "reading sessions select own or public personal profile"
on public.reading_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    schedule_id is null
    and personal_paper_id is not null
    and private.is_profile_public(user_id)
  )
);

drop policy if exists "comments select schedule members" on public.comments;
create policy "comments select active schedule members"
on public.comments
for select
to authenticated
using (
  deleted_at is null
  and private.is_schedule_member(schedule_id)
);

drop policy if exists "paper annotations select schedule members"
on public.paper_annotations;
create policy "paper annotations select active schedule members"
on public.paper_annotations
for select
to authenticated
using (
  deleted_at is null
  and private.is_schedule_member(schedule_id)
);

drop policy if exists "paper annotation replies select annotation members"
on public.paper_annotation_replies;
create policy "paper annotation replies select active annotation members"
on public.paper_annotation_replies
for select
to authenticated
using (
  deleted_at is null
  and private.is_annotation_member(annotation_id)
);

drop policy if exists "papers select visible papers" on public.papers;
create policy "papers select visible papers"
on public.papers
for select
to authenticated
using (private.can_access_paper(id));

create or replace function private.create_manual_paper(
  p_metadata jsonb,
  p_manual_scope text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(pg_catalog.btrim(p_metadata ->> 'title'), '');
  v_external_url text := private.normalize_manual_url(p_metadata ->> 'external_url');
  v_authors jsonb := coalesce(p_metadata -> 'authors', '[]'::jsonb);
  v_abstract text := nullif(pg_catalog.btrim(p_metadata ->> 'abstract'), '');
  v_doi text := nullif(pg_catalog.btrim(p_metadata ->> 'doi'), '');
  v_license text := nullif(pg_catalog.btrim(p_metadata ->> 'license'), '');
  v_paper_id uuid;
begin
  if p_manual_scope is null
    or p_manual_scope !~ '^(user|club):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'manual paper scope is invalid';
  end if;

  if v_title is null or pg_catalog.char_length(v_title) > 500 then
    raise exception 'manual metadata requires a title of at most 500 characters';
  end if;

  if v_external_url is null then
    raise exception 'manual metadata requires a valid HTTP(S) URL without credentials, whitespace, or control characters';
  end if;

  if not private.paper_authors_are_valid(v_authors) then
    raise exception 'authors must be an array of at most 100 non-empty strings of at most 300 characters';
  end if;

  if v_abstract is not null and pg_catalog.char_length(v_abstract) > 100000 then
    raise exception 'abstract must be at most 100000 characters';
  end if;

  if v_doi is not null and pg_catalog.char_length(v_doi) > 512 then
    raise exception 'doi must be at most 512 characters';
  end if;

  if v_license is not null and pg_catalog.char_length(v_license) > 2000 then
    raise exception 'license must be at most 2000 characters';
  end if;

  insert into public.papers (
    source_type,
    title,
    authors,
    abstract,
    doi,
    license,
    external_url,
    manual_scope
  )
  values (
    'manual'::public.paper_source_type,
    v_title,
    v_authors,
    v_abstract,
    v_doi,
    v_license,
    v_external_url,
    p_manual_scope
  )
  on conflict (manual_scope, (private.normalize_manual_url(external_url)))
    where source_type = 'manual'::public.paper_source_type
  do update set external_url = excluded.external_url
  returning public.papers.id into v_paper_id;

  return v_paper_id;
end;
$$;

revoke all on function private.create_manual_paper(jsonb, text)
from public, anon, authenticated, service_role;

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

  if p_notes is not null and pg_catalog.char_length(p_notes) > 2000 then
    raise exception 'notes must be at most 2000 characters';
  end if;

  v_paper_id := private.create_manual_paper(
    p_metadata,
    'club:' || p_club_id::text
  );

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
    nullif(pg_catalog.btrim(p_notes), ''),
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
  v_source_paper public.papers;
  v_target_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_member(p_club_id) then
    raise exception 'only club members can schedule papers';
  end if;

  if p_notes is not null and pg_catalog.char_length(p_notes) > 2000 then
    raise exception 'notes must be at most 2000 characters';
  end if;

  select p.*
  into v_source_paper
  from public.papers p
  where p.id = p_paper_id;

  if v_source_paper.id is null
    or not private.can_access_paper(p_paper_id) then
    raise exception 'paper not found or inaccessible';
  end if;

  if v_source_paper.source_type = 'manual'::public.paper_source_type then
    v_target_paper_id := private.create_manual_paper(
      pg_catalog.jsonb_build_object(
        'title', v_source_paper.title,
        'authors', v_source_paper.authors,
        'abstract', v_source_paper.abstract,
        'doi', v_source_paper.doi,
        'license', v_source_paper.license,
        'external_url', v_source_paper.external_url
      ),
      'club:' || p_club_id::text
    );
  else
    v_target_paper_id := v_source_paper.id;
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
    v_target_paper_id,
    p_week_start,
    nullif(pg_catalog.btrim(p_notes), ''),
    v_user_id
  )
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function private.upsert_arxiv_paper(p_arxiv_metadata jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'title'), '');
  v_arxiv_id text := pg_catalog.regexp_replace(
    nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'arxiv_id'), ''),
    'v[0-9]+$',
    ''
  );
  v_abstract_url text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'abstract_url'), '');
  v_pdf_url text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'pdf_url'), '');
  v_authors jsonb := coalesce(p_arxiv_metadata -> 'authors', '[]'::jsonb);
  v_abstract text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'abstract'), '');
  v_doi text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'doi'), '');
  v_license text := nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'license'), '');
  v_paper_id uuid;
begin
  if v_title is null or pg_catalog.char_length(v_title) > 500 or v_arxiv_id is null then
    raise exception 'arxiv metadata requires title and arxiv_id';
  end if;

  if not private.paper_authors_are_valid(v_authors) then
    raise exception 'authors must be an array of at most 100 non-empty strings of at most 300 characters';
  end if;

  if v_abstract is not null and pg_catalog.char_length(v_abstract) > 100000 then
    raise exception 'abstract must be at most 100000 characters';
  end if;

  if v_doi is not null and pg_catalog.char_length(v_doi) > 512 then
    raise exception 'doi must be at most 512 characters';
  end if;

  if v_license is not null and pg_catalog.char_length(v_license) > 2000 then
    raise exception 'license must be at most 2000 characters';
  end if;

  if v_arxiv_id !~ '^([0-9]{4}\.[0-9]{4,5}|[A-Za-z][A-Za-z0-9.-]+/[0-9]{7})$' then
    raise exception 'arxiv_id is not canonical';
  end if;

  if v_abstract_url is distinct from 'https://arxiv.org/abs/' || v_arxiv_id
    or v_pdf_url is distinct from 'https://arxiv.org/pdf/' || v_arxiv_id then
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
    'arxiv'::public.paper_source_type,
    v_title,
    v_authors,
    v_abstract,
    v_doi,
    v_license,
    v_arxiv_id,
    v_abstract_url,
    v_pdf_url,
    nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'published_at'), '')::timestamptz,
    nullif(pg_catalog.btrim(p_arxiv_metadata ->> 'updated_at'), '')::timestamptz
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
    updated_at = pg_catalog.now()
  returning id into v_paper_id;

  return v_paper_id;
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

  v_paper_id := private.create_manual_paper(
    p_metadata,
    'user:' || v_user_id::text
  );

  insert into public.personal_papers (user_id, paper_id, deadline)
  values (v_user_id, v_paper_id, p_deadline)
  on conflict on constraint pers_paper_user_paper_unique
  do update set
    deadline = coalesce(excluded.deadline, public.personal_papers.deadline)
  returning * into v_personal_paper;

  return v_personal_paper;
end;
$$;

drop function private.create_manual_paper(jsonb);

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

  if p_page_count is null or p_page_count not between 1 and 100000 then
    raise exception 'page_count must be between 1 and 100000';
  end if;

  if not private.can_edit_paper(p_paper_id) then
    raise exception 'paper is not editable by the current user';
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

create or replace function public.import_arxiv_personal(
  p_user_id uuid,
  p_arxiv_metadata jsonb,
  p_deadline date default null
)
returns public.personal_papers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper_id uuid;
  v_personal_paper public.personal_papers;
begin
  if p_user_id is null
    or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'target profile not found';
  end if;

  v_paper_id := private.upsert_arxiv_paper(p_arxiv_metadata);

  insert into public.personal_papers (user_id, paper_id, deadline)
  values (p_user_id, v_paper_id, p_deadline)
  on conflict on constraint pers_paper_user_paper_unique
  do update set
    deadline = coalesce(excluded.deadline, public.personal_papers.deadline)
  returning * into v_personal_paper;

  return v_personal_paper;
end;
$$;

create or replace function public.import_arxiv_schedule(
  p_user_id uuid,
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
  v_paper_id uuid;
  v_schedule public.club_paper_schedule;
begin
  if p_user_id is null or not exists (
    select 1
    from public.club_members cm
    where cm.club_id = p_club_id
      and cm.user_id = p_user_id
  ) then
    raise exception 'target user is not a member of this club';
  end if;

  if p_notes is not null and pg_catalog.char_length(p_notes) > 2000 then
    raise exception 'notes must be at most 2000 characters';
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
    nullif(pg_catalog.btrim(p_notes), ''),
    p_user_id
  )
  on conflict (club_id, paper_id, week_start)
  do update set
    notes = coalesce(
      public.club_paper_schedule.notes,
      excluded.notes
    )
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.save_schedule_reading_progress(
  p_schedule_id uuid,
  p_current_page integer,
  p_total_pages integer,
  p_status public.paper_status
)
returns table (
  context_id uuid,
  current_page integer,
  total_pages integer,
  saved_status public.paper_status,
  read boolean,
  reading_session_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_schedule public.club_paper_schedule;
  v_existing_page bigint;
  v_delta integer;
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_current_page is null or p_current_page < 0 then
    raise exception 'current page must be zero or greater';
  end if;

  if p_total_pages is null or p_total_pages not between 1 and 100000 then
    raise exception 'total pages must be between 1 and 100000';
  end if;

  if p_current_page > p_total_pages then
    raise exception 'current page cannot exceed total pages';
  end if;

  if p_status is null then
    raise exception 'status is required';
  end if;

  if p_status = 'read'::public.paper_status
    and p_current_page <> p_total_pages then
    raise exception 'read status requires current page to equal total pages';
  end if;

  if p_current_page > 0 and p_status = 'planned'::public.paper_status then
    raise exception 'planned status cannot include reading progress';
  end if;

  if not private.is_schedule_member(p_schedule_id) then
    raise exception 'only club members can save schedule reading progress';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'schedule-progress:' || p_schedule_id::text || ':' || v_user_id::text,
      0
    )
  );

  select cps.*
  into v_schedule
  from public.club_paper_schedule cps
  where cps.id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception 'scheduled paper not found';
  end if;

  select coalesce(pg_catalog.sum(rs.pages_read), 0)
  into v_existing_page
  from public.reading_sessions rs
  where rs.schedule_id = p_schedule_id
    and rs.user_id = v_user_id;

  if p_current_page < v_existing_page then
    raise exception 'current page cannot move backwards';
  end if;

  v_delta := p_current_page - v_existing_page::integer;

  if v_delta > 0 then
    insert into public.reading_sessions (schedule_id, user_id, pages_read)
    values (p_schedule_id, v_user_id, v_delta)
    returning id into v_session_id;
  end if;

  update public.club_paper_schedule
  set page_count = p_total_pages
  where id = p_schedule_id;

  perform private.apply_schedule_status(p_schedule_id, v_user_id, p_status);

  context_id := p_schedule_id;
  current_page := p_current_page;
  total_pages := p_total_pages;
  saved_status := p_status;
  read := p_status = 'read'::public.paper_status;
  reading_session_id := v_session_id;
  return next;
end;
$$;

create or replace function public.save_personal_reading_progress(
  p_personal_paper_id uuid,
  p_current_page integer,
  p_total_pages integer,
  p_status public.paper_status
)
returns table (
  context_id uuid,
  current_page integer,
  total_pages integer,
  saved_status public.paper_status,
  read boolean,
  reading_session_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_personal_paper public.personal_papers;
  v_existing_page bigint;
  v_delta integer;
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_current_page is null or p_current_page < 0 then
    raise exception 'current page must be zero or greater';
  end if;

  if p_total_pages is null or p_total_pages not between 1 and 100000 then
    raise exception 'total pages must be between 1 and 100000';
  end if;

  if p_current_page > p_total_pages then
    raise exception 'current page cannot exceed total pages';
  end if;

  if p_status is null then
    raise exception 'status is required';
  end if;

  if p_status = 'read'::public.paper_status
    and p_current_page <> p_total_pages then
    raise exception 'read status requires current page to equal total pages';
  end if;

  if p_current_page > 0 and p_status = 'planned'::public.paper_status then
    raise exception 'planned status cannot include reading progress';
  end if;

  if not private.is_personal_paper_owner(p_personal_paper_id) then
    raise exception 'personal paper not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'personal-progress:' || p_personal_paper_id::text || ':' || v_user_id::text,
      0
    )
  );

  select pp.*
  into v_personal_paper
  from public.personal_papers pp
  where pp.id = p_personal_paper_id
    and pp.user_id = v_user_id
  for update;

  if v_personal_paper.id is null then
    raise exception 'personal paper not found';
  end if;

  select coalesce(pg_catalog.sum(rs.pages_read), 0)
  into v_existing_page
  from public.reading_sessions rs
  where rs.personal_paper_id = p_personal_paper_id
    and rs.user_id = v_user_id;

  if p_current_page < v_existing_page then
    raise exception 'current page cannot move backwards';
  end if;

  v_delta := p_current_page - v_existing_page::integer;

  if v_delta > 0 then
    insert into public.reading_sessions (personal_paper_id, user_id, pages_read)
    values (p_personal_paper_id, v_user_id, v_delta)
    returning id into v_session_id;
  end if;

  update public.personal_papers
  set
    page_count = p_total_pages,
    status = p_status,
    read_at = case
      when p_status = 'read'::public.paper_status
        then coalesce(read_at, pg_catalog.now())
      else null
    end
  where id = p_personal_paper_id
    and user_id = v_user_id;

  context_id := p_personal_paper_id;
  current_page := p_current_page;
  total_pages := p_total_pages;
  saved_status := p_status;
  read := p_status = 'read'::public.paper_status;
  reading_session_id := v_session_id;
  return next;
end;
$$;

create table private.arxiv_rate_limits (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count between 1 and 30),
  updated_at timestamptz not null default pg_catalog.now()
);

revoke all on private.arxiv_rate_limits
from public, anon, authenticated, service_role;

create or replace function public.consume_arxiv_rate_limit(p_user_id uuid)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
begin
  if p_user_id is null
    or not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'A valid user profile is required for arXiv lookup.';
  end if;

  insert into private.arxiv_rate_limits (
    user_id,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_user_id, v_now, 1, v_now)
  on conflict (user_id)
  do update set
    window_started_at = case
      when private.arxiv_rate_limits.window_started_at <= v_now - interval '5 minutes'
        then v_now
      else private.arxiv_rate_limits.window_started_at
    end,
    request_count = case
      when private.arxiv_rate_limits.window_started_at <= v_now - interval '5 minutes'
        then 1
      else private.arxiv_rate_limits.request_count + 1
    end,
    updated_at = v_now
  where private.arxiv_rate_limits.window_started_at <= v_now - interval '5 minutes'
    or private.arxiv_rate_limits.request_count < 30
  returning request_count, window_started_at
  into v_count, v_window_started_at;

  if v_count is null then
    select arl.window_started_at + interval '5 minutes'
    into v_reset_at
    from private.arxiv_rate_limits arl
    where arl.user_id = p_user_id;

    raise exception using
      errcode = 'P0001',
      message = pg_catalog.format(
        'arXiv lookup rate limit exceeded. Try again after %s.',
        pg_catalog.to_char(v_reset_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS UTC')
      );
  end if;

  allowed := true;
  remaining := 30 - v_count;
  reset_at := v_window_started_at + interval '5 minutes';
  return next;
end;
$$;

-- Supabase grants broad privileges to new public objects by default. Replace
-- them with the application's explicit least-privilege contract.
revoke all on all tables in schema public
from public, anon, authenticated;
revoke all on all sequences in schema public
from public, anon, authenticated;
revoke all on all functions in schema public
from public, anon, authenticated;
revoke all on all tables in schema private
from public, anon, authenticated;
revoke all on all sequences in schema private
from public, anon, authenticated;
revoke all on all functions in schema private
from public, anon, authenticated;

alter default privileges for role postgres in schema public
revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema private
revoke all on functions from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant insert (
  id,
  display_name,
  avatar_id,
  avatar_color,
  bio,
  is_public
) on public.profiles to authenticated;
grant update (
  display_name,
  avatar_id,
  avatar_color,
  bio,
  is_public
) on public.profiles to authenticated;

grant select on public.clubs to authenticated;
grant update (name, description) on public.clubs to authenticated;

grant select on public.club_members to authenticated;

grant select (
  id,
  club_id,
  status,
  created_by,
  expires_at,
  created_at,
  accepted_by,
  accepted_at
) on public.club_invites to authenticated;
grant select on public.papers to authenticated;
grant select on public.club_paper_schedule to authenticated;
grant select on public.reading_logs to authenticated;

grant select on public.comments to authenticated;
grant insert (schedule_id, author_id, body)
on public.comments to authenticated;
grant update (body)
on public.comments to authenticated;

grant select on public.paper_annotations to authenticated;
grant insert (
  schedule_id,
  paper_id,
  author_id,
  kind,
  page_number,
  position,
  quote,
  body,
  color
) on public.paper_annotations to authenticated;
grant update (
  kind,
  page_number,
  position,
  quote,
  body,
  color
) on public.paper_annotations to authenticated;

grant select on public.paper_annotation_replies to authenticated;
grant insert (annotation_id, author_id, body)
on public.paper_annotation_replies to authenticated;
grant update (body)
on public.paper_annotation_replies to authenticated;

grant select on public.personal_papers to authenticated;
grant select on public.schedule_paper_statuses to authenticated;
grant select on public.reading_sessions to authenticated;

grant execute on function private.shares_club_with(uuid) to authenticated;
grant execute on function private.is_club_member(uuid) to authenticated;
grant execute on function private.is_club_manager(uuid) to authenticated;
grant execute on function private.is_schedule_member(uuid) to authenticated;
grant execute on function private.is_schedule_manager(uuid) to authenticated;
grant execute on function private.is_annotation_member(uuid) to authenticated;
grant execute on function private.is_annotation_manager(uuid) to authenticated;
grant execute on function private.is_profile_public(uuid) to authenticated;
grant execute on function private.can_view_profile_activity(uuid) to authenticated;
grant execute on function private.can_access_paper(uuid) to authenticated;

grant execute on function public.create_club(text, text, text)
to authenticated;
grant execute on function public.create_invite_link(uuid, timestamptz)
to authenticated;
grant execute on function public.revoke_invite_link(uuid)
to authenticated;
grant execute on function public.accept_invite(text)
to authenticated;
grant execute on function public.schedule_manual_paper(uuid, date, jsonb, text)
to authenticated;
grant execute on function public.schedule_existing_paper(uuid, uuid, date, text)
to authenticated;
grant execute on function public.add_personal_manual_paper(jsonb, date)
to authenticated;
grant execute on function public.save_schedule_reading_progress(
  uuid,
  integer,
  integer,
  public.paper_status
) to authenticated;
grant execute on function public.save_personal_reading_progress(
  uuid,
  integer,
  integer,
  public.paper_status
) to authenticated;
grant execute on function public.get_club_schedule_progress(uuid)
to authenticated;
grant execute on function public.set_club_member_role(
  uuid,
  uuid,
  public.club_role
) to authenticated;
grant execute on function public.transfer_club_ownership(uuid, uuid)
to authenticated;
grant execute on function public.update_scheduled_paper_deadline(uuid, date)
to authenticated;
grant execute on function public.delete_scheduled_paper(uuid)
to authenticated;
grant execute on function public.leave_club(uuid)
to authenticated;
grant execute on function public.soft_delete_comment(uuid)
to authenticated;
grant execute on function public.soft_delete_paper_annotation(uuid)
to authenticated;
grant execute on function public.soft_delete_paper_annotation_reply(uuid)
to authenticated;

revoke all on function public.schedule_arxiv_paper(uuid, date, jsonb, text)
from service_role;
revoke all on function public.add_personal_arxiv_paper(jsonb, date)
from service_role;
revoke all on function public.update_paper_page_count(uuid, integer)
from service_role;
revoke all on function public.set_schedule_paper_status(uuid, public.paper_status)
from service_role;
revoke all on function public.toggle_read_status(uuid, boolean)
from service_role;
revoke all on function public.set_personal_paper_status(uuid, public.paper_status)
from service_role;
revoke all on function public.toggle_personal_paper_read_status(uuid, boolean)
from service_role;
revoke all on function public.log_schedule_reading_session(uuid, integer)
from service_role;
revoke all on function public.log_personal_paper_reading_session(uuid, integer)
from service_role;
revoke all on function private.upsert_arxiv_paper(jsonb)
from service_role;

grant execute on function public.import_arxiv_personal(uuid, jsonb, date)
to service_role;
grant execute on function public.import_arxiv_schedule(
  uuid,
  uuid,
  date,
  jsonb,
  text
) to service_role;
grant execute on function public.consume_arxiv_rate_limit(uuid)
to service_role;
