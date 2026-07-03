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
    notes = excluded.notes,
    created_by = excluded.created_by
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
    notes = excluded.notes,
    created_by = excluded.created_by
  returning * into v_schedule;

  return v_schedule;
end;
$$;

revoke all on function public.schedule_arxiv_paper(uuid, date, jsonb, text) from public;
revoke all on function public.schedule_manual_paper(uuid, date, jsonb, text) from public;
grant execute on function public.schedule_arxiv_paper(uuid, date, jsonb, text) to authenticated;
grant execute on function public.schedule_manual_paper(uuid, date, jsonb, text) to authenticated;
