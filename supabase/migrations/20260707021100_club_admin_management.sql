create unique index if not exists club_members_one_owner_per_club_idx
on public.club_members (club_id)
where role = 'owner'::public.club_role;

create or replace function private.is_club_manager(p_club_id uuid)
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
      and cm.role::text in ('owner', 'admin')
  );
$$;

create or replace function private.is_schedule_manager(p_schedule_id uuid)
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
      and cm.role::text in ('owner', 'admin')
  );
$$;

create or replace function private.is_annotation_manager(p_annotation_id uuid)
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
      and private.is_schedule_manager(pa.schedule_id)
  );
$$;

create or replace function public.guard_club_member_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allow_owner_transfer boolean :=
    current_setting('app.allow_club_owner_transfer', true) = 'on';
begin
  if new.club_id is distinct from old.club_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'club member identity fields are immutable';
  end if;

  if v_allow_owner_transfer then
    return new;
  end if;

  if old.role::text = 'owner' or new.role::text = 'owner' then
    raise exception 'owner role changes must use transfer_club_ownership';
  end if;

  if not private.is_club_manager(old.club_id) then
    raise exception 'only club admins can change member roles';
  end if;

  return new;
end;
$$;

create or replace function public.guard_club_member_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role::text = 'owner' then
    raise exception 'club owners cannot be deleted';
  end if;

  if not private.is_club_manager(old.club_id) then
    raise exception 'only club admins can remove members';
  end if;

  return old;
end;
$$;

drop trigger if exists club_members_guard_update on public.club_members;
create trigger club_members_guard_update
before update on public.club_members
for each row execute function public.guard_club_member_update();

drop trigger if exists club_members_guard_delete on public.club_members;
create trigger club_members_guard_delete
before delete on public.club_members
for each row execute function public.guard_club_member_delete();

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

  if private.is_schedule_manager(old.schedule_id) then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'admins can only soft-delete comments';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update comment';
end;
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

  if private.is_schedule_manager(old.schedule_id) then
    if new.kind is distinct from old.kind
      or new.page_number is distinct from old.page_number
      or new.position is distinct from old.position
      or new.quote is distinct from old.quote
      or new.body is distinct from old.body
      or new.color is distinct from old.color
      or new.deleted_at is null then
      raise exception 'admins can only soft-delete annotations';
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

  if private.is_annotation_manager(old.annotation_id) then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'admins can only soft-delete annotation replies';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update annotation reply';
end;
$$;

drop policy if exists "clubs update owners" on public.clubs;
drop policy if exists "clubs update managers" on public.clubs;
create policy "clubs update managers"
on public.clubs
for update
to authenticated
using (private.is_club_manager(id))
with check (private.is_club_manager(id));

drop policy if exists "club members insert by owners" on public.club_members;
drop policy if exists "club members insert by managers" on public.club_members;
create policy "club members insert by managers"
on public.club_members
for insert
to authenticated
with check (private.is_club_manager(club_id));

drop policy if exists "club members update by owners" on public.club_members;
drop policy if exists "club members update by managers" on public.club_members;
create policy "club members update by managers"
on public.club_members
for update
to authenticated
using (private.is_club_manager(club_id))
with check (private.is_club_manager(club_id));

drop policy if exists "club members delete by owners" on public.club_members;
drop policy if exists "club members delete by managers" on public.club_members;
create policy "club members delete by managers"
on public.club_members
for delete
to authenticated
using (private.is_club_manager(club_id));

drop policy if exists "club invites select owners" on public.club_invites;
drop policy if exists "club invites select managers" on public.club_invites;
create policy "club invites select managers"
on public.club_invites
for select
to authenticated
using (private.is_club_manager(club_id));

drop policy if exists "club schedule delete owners" on public.club_paper_schedule;
drop policy if exists "club schedule delete managers" on public.club_paper_schedule;
create policy "club schedule delete managers"
on public.club_paper_schedule
for delete
to authenticated
using (private.is_club_manager(club_id));

drop policy if exists "comments soft delete owners" on public.comments;
drop policy if exists "comments soft delete managers" on public.comments;
create policy "comments soft delete managers"
on public.comments
for update
to authenticated
using (private.is_schedule_manager(schedule_id))
with check (
  private.is_schedule_manager(schedule_id)
  and deleted_at is not null
);

drop policy if exists "paper annotations soft delete owners" on public.paper_annotations;
drop policy if exists "paper annotations soft delete managers" on public.paper_annotations;
create policy "paper annotations soft delete managers"
on public.paper_annotations
for update
to authenticated
using (private.is_schedule_manager(schedule_id))
with check (
  private.is_schedule_manager(schedule_id)
  and deleted_at is not null
);

drop policy if exists "paper annotation replies soft delete owners" on public.paper_annotation_replies;
drop policy if exists "paper annotation replies soft delete managers" on public.paper_annotation_replies;
create policy "paper annotation replies soft delete managers"
on public.paper_annotation_replies
for update
to authenticated
using (private.is_annotation_manager(annotation_id))
with check (
  private.is_annotation_manager(annotation_id)
  and deleted_at is not null
);

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

  if not private.is_club_manager(p_club_id) then
    raise exception 'only club admins can create invite links';
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

  if not private.is_club_manager(v_invite.club_id) then
    raise exception 'only club admins can revoke invite links';
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

create or replace function public.set_club_member_role(
  p_club_id uuid,
  p_user_id uuid,
  p_role public.club_role
)
returns public.club_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_member public.club_members;
begin
  if v_actor_id is null then
    raise exception 'not authenticated';
  end if;

  if p_role is null or p_role::text not in ('admin', 'member') then
    raise exception 'role must be admin or member';
  end if;

  if not private.is_club_manager(p_club_id) then
    raise exception 'only club admins can change member roles';
  end if;

  select *
  into v_member
  from public.club_members
  where club_id = p_club_id
    and user_id = p_user_id
  for update;

  if v_member.user_id is null then
    raise exception 'club member not found';
  end if;

  if v_member.role::text = 'owner' then
    raise exception 'owner role changes must use transfer_club_ownership';
  end if;

  update public.club_members
  set role = p_role
  where club_id = p_club_id
    and user_id = p_user_id
  returning * into v_member;

  return v_member;
end;
$$;

create or replace function public.transfer_club_ownership(
  p_club_id uuid,
  p_new_owner_id uuid
)
returns public.club_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_new_owner public.club_members;
  v_previous_owner public.club_members;
begin
  if v_actor_id is null then
    raise exception 'not authenticated';
  end if;

  if not private.is_club_owner(p_club_id) then
    raise exception 'only club owners can transfer ownership';
  end if;

  if p_new_owner_id = v_actor_id then
    raise exception 'choose another member to transfer ownership';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_club_id::text));

  select *
  into v_new_owner
  from public.club_members
  where club_id = p_club_id
    and user_id = p_new_owner_id
  for update;

  if v_new_owner.user_id is null then
    raise exception 'new owner must be a club member';
  end if;

  if v_new_owner.role::text = 'owner' then
    raise exception 'member is already the owner';
  end if;

  perform set_config('app.allow_club_owner_transfer', 'on', true);

  update public.club_members
  set role = 'admin'::public.club_role
  where club_id = p_club_id
    and user_id = v_actor_id
    and role::text = 'owner'
  returning * into v_previous_owner;

  if v_previous_owner.user_id is null then
    raise exception 'current owner membership not found';
  end if;

  update public.club_members
  set role = 'owner'::public.club_role
  where club_id = p_club_id
    and user_id = p_new_owner_id
  returning * into v_new_owner;

  return v_new_owner;
end;
$$;

create or replace function public.update_scheduled_paper_deadline(
  p_schedule_id uuid,
  p_week_start date default null
)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_schedule public.club_paper_schedule;
begin
  if v_actor_id is null then
    raise exception 'not authenticated';
  end if;

  select *
  into v_schedule
  from public.club_paper_schedule
  where id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception 'scheduled paper not found';
  end if;

  if not private.is_club_manager(v_schedule.club_id) then
    raise exception 'only club admins can edit scheduled papers';
  end if;

  update public.club_paper_schedule
  set week_start = p_week_start
  where id = p_schedule_id
  returning * into v_schedule;

  return v_schedule;
end;
$$;

create or replace function public.delete_scheduled_paper(p_schedule_id uuid)
returns public.club_paper_schedule
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_schedule public.club_paper_schedule;
begin
  if v_actor_id is null then
    raise exception 'not authenticated';
  end if;

  select *
  into v_schedule
  from public.club_paper_schedule
  where id = p_schedule_id
  for update;

  if v_schedule.id is null then
    raise exception 'scheduled paper not found';
  end if;

  if not private.is_club_manager(v_schedule.club_id) then
    raise exception 'only club admins can delete scheduled papers';
  end if;

  delete from public.club_paper_schedule
  where id = p_schedule_id
  returning * into v_schedule;

  return v_schedule;
end;
$$;

revoke execute on function private.is_club_manager(uuid) from public, anon, authenticated;
revoke execute on function private.is_schedule_manager(uuid) from public, anon, authenticated;
revoke execute on function private.is_annotation_manager(uuid) from public, anon, authenticated;
grant execute on function private.is_club_manager(uuid) to authenticated;
grant execute on function private.is_schedule_manager(uuid) to authenticated;
grant execute on function private.is_annotation_manager(uuid) to authenticated;

revoke all on function public.guard_club_member_update() from public;
revoke all on function public.guard_club_member_delete() from public;
revoke all on function public.set_club_member_role(uuid, uuid, public.club_role) from public;
revoke all on function public.transfer_club_ownership(uuid, uuid) from public;
revoke all on function public.update_scheduled_paper_deadline(uuid, date) from public;
revoke all on function public.delete_scheduled_paper(uuid) from public;

grant execute on function public.set_club_member_role(uuid, uuid, public.club_role) to authenticated;
grant execute on function public.transfer_club_ownership(uuid, uuid) to authenticated;
grant execute on function public.update_scheduled_paper_deadline(uuid, date) to authenticated;
grant execute on function public.delete_scheduled_paper(uuid) to authenticated;
