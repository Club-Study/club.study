create type public.paper_annotation_kind as enum (
  'highlight',
  'question',
  'explanation',
  'note'
);

create table public.paper_annotations (
  id uuid primary key default extensions.gen_random_uuid(),
  schedule_id uuid not null references public.club_paper_schedule (id) on delete cascade,
  paper_id uuid not null references public.papers (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind public.paper_annotation_kind not null,
  page_number integer not null check (page_number > 0),
  position jsonb not null check (jsonb_typeof(position) = 'object'),
  quote text check (
    quote is null
    or char_length(quote) <= 5000
  ),
  body text check (
    body is null
    or char_length(btrim(body)) between 1 and 5000
  ),
  color text not null default '#facc15' check (
    color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.paper_annotation_replies (
  id uuid primary key default extensions.gen_random_uuid(),
  annotation_id uuid not null references public.paper_annotations (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index paper_annotations_schedule_paper_page_active_idx
on public.paper_annotations (schedule_id, paper_id, page_number, created_at)
where deleted_at is null;

create index paper_annotations_author_id_idx
on public.paper_annotations (author_id);

create index paper_annotation_replies_annotation_created_active_idx
on public.paper_annotation_replies (annotation_id, created_at)
where deleted_at is null;

create index paper_annotation_replies_author_id_idx
on public.paper_annotation_replies (author_id);

create trigger paper_annotations_set_updated_at
before update on public.paper_annotations
for each row execute function public.set_updated_at();

create trigger paper_annotation_replies_set_updated_at
before update on public.paper_annotation_replies
for each row execute function public.set_updated_at();

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
      and private.is_schedule_member(pa.schedule_id)
  );
$$;

create or replace function private.is_annotation_owner(p_annotation_id uuid)
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
      and private.is_schedule_owner(pa.schedule_id)
  );
$$;

create or replace function public.guard_paper_annotation_update()
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
    or new.paper_id is distinct from old.paper_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'annotation identity fields are immutable';
  end if;

  if old.deleted_at is not null then
    raise exception 'deleted annotations cannot be updated';
  end if;

  if v_user_id = old.author_id then
    return new;
  end if;

  if private.is_schedule_owner(old.schedule_id) then
    if new.kind is distinct from old.kind
      or new.page_number is distinct from old.page_number
      or new.position is distinct from old.position
      or new.quote is distinct from old.quote
      or new.body is distinct from old.body
      or new.color is distinct from old.color
      or new.deleted_at is null then
      raise exception 'owners can only soft-delete annotations';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update annotation';
end;
$$;

create or replace function public.guard_paper_annotation_reply_update()
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
    or new.annotation_id is distinct from old.annotation_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'reply identity fields are immutable';
  end if;

  if old.deleted_at is not null then
    raise exception 'deleted annotation replies cannot be updated';
  end if;

  if v_user_id = old.author_id then
    return new;
  end if;

  if private.is_annotation_owner(old.annotation_id) then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'owners can only soft-delete annotation replies';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update annotation reply';
end;
$$;

create trigger paper_annotations_guard_update
before update on public.paper_annotations
for each row execute function public.guard_paper_annotation_update();

create trigger paper_annotation_replies_guard_update
before update on public.paper_annotation_replies
for each row execute function public.guard_paper_annotation_reply_update();

alter table public.paper_annotations enable row level security;
alter table public.paper_annotation_replies enable row level security;

create policy "paper annotations select schedule members"
on public.paper_annotations
for select
to authenticated
using (private.is_schedule_member(schedule_id));

create policy "paper annotations insert schedule members"
on public.paper_annotations
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and deleted_at is null
  and private.is_schedule_member(schedule_id)
);

create policy "paper annotations update authors"
on public.paper_annotations
for update
to authenticated
using (author_id = (select auth.uid()))
with check (
  private.is_schedule_member(schedule_id)
  and author_id = (select auth.uid())
);

create policy "paper annotations soft delete owners"
on public.paper_annotations
for update
to authenticated
using (private.is_schedule_owner(schedule_id))
with check (
  private.is_schedule_owner(schedule_id)
  and deleted_at is not null
);

create policy "paper annotation replies select annotation members"
on public.paper_annotation_replies
for select
to authenticated
using (private.is_annotation_member(annotation_id));

create policy "paper annotation replies insert annotation members"
on public.paper_annotation_replies
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and deleted_at is null
  and private.is_annotation_member(annotation_id)
);

create policy "paper annotation replies update authors"
on public.paper_annotation_replies
for update
to authenticated
using (author_id = (select auth.uid()))
with check (
  private.is_annotation_member(annotation_id)
  and author_id = (select auth.uid())
);

create policy "paper annotation replies soft delete owners"
on public.paper_annotation_replies
for update
to authenticated
using (private.is_annotation_owner(annotation_id))
with check (
  private.is_annotation_owner(annotation_id)
  and deleted_at is not null
);

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
  color,
  deleted_at
) on public.paper_annotations to authenticated;

grant select on public.paper_annotation_replies to authenticated;
grant insert (
  annotation_id,
  author_id,
  body
) on public.paper_annotation_replies to authenticated;
grant update (
  body,
  deleted_at
) on public.paper_annotation_replies to authenticated;

revoke all on function private.is_annotation_member(uuid) from public, anon, authenticated;
revoke all on function private.is_annotation_owner(uuid) from public, anon, authenticated;
revoke all on function public.guard_paper_annotation_update() from public;
revoke all on function public.guard_paper_annotation_reply_update() from public;

grant execute on function private.is_annotation_member(uuid) to authenticated;
grant execute on function private.is_annotation_owner(uuid) to authenticated;
