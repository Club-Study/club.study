create or replace function public.guard_club_member_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allow_owner_leave boolean :=
    current_setting('app.allow_club_owner_leave', true) = 'on';
  v_allow_member_leave boolean :=
    current_setting('app.allow_club_member_leave', true) = 'on';
begin
  if old.role::text = 'owner' and not v_allow_owner_leave then
    raise exception 'club owners cannot be deleted';
  end if;

  if not v_allow_owner_leave
    and not v_allow_member_leave
    and not private.is_club_manager(old.club_id) then
    raise exception 'only club admins can remove members';
  end if;

  return old;
end;
$$;

create or replace function public.leave_club(p_club_id uuid)
returns table (
  club_id uuid,
  deleted_club boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.club_members;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_club_id::text));

  select *
  into v_membership
  from public.club_members
  where club_members.club_id = p_club_id
    and club_members.user_id = v_user_id
  for update;

  if v_membership.user_id is null then
    raise exception 'club membership not found';
  end if;

  select count(*)::integer
  into v_member_count
  from public.club_members
  where club_members.club_id = p_club_id;

  if v_membership.role::text = 'owner' and v_member_count > 1 then
    raise exception 'transfer ownership before leaving this club';
  end if;

  club_id := p_club_id;
  deleted_club := v_member_count = 1;

  if deleted_club then
    perform set_config('app.allow_club_owner_leave', 'on', true);

    delete from public.clubs
    where clubs.id = p_club_id;
  else
    perform set_config('app.allow_club_member_leave', 'on', true);

    delete from public.club_members
    where club_members.club_id = p_club_id
      and club_members.user_id = v_user_id;
  end if;

  return next;
end;
$$;

revoke all on function public.guard_club_member_delete() from public;
revoke all on function public.leave_club(uuid) from public;
grant execute on function public.leave_club(uuid) to authenticated;
