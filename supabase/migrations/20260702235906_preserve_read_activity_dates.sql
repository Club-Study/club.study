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
    do nothing;
  else
    delete from public.reading_logs
    where schedule_id = p_schedule_id
      and user_id = v_user_id;
  end if;

  return p_read;
end;
$$;

revoke all on function public.toggle_read_status(uuid, boolean) from public;
grant execute on function public.toggle_read_status(uuid, boolean) to authenticated;
