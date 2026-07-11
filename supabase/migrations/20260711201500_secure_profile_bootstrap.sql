create or replace function public.ensure_profile(
  p_display_name text,
  p_avatar_id text default 'bookworm',
  p_avatar_color text default '#65a30d'
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_display_name text := pg_catalog.btrim(coalesce(p_display_name, ''));
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'sign in required';
  end if;

  if pg_catalog.char_length(v_display_name) not between 1 and 120 then
    raise exception 'display name must be between 1 and 120 characters';
  end if;

  insert into public.profiles (
    id,
    display_name,
    avatar_id,
    avatar_color
  )
  values (
    v_user_id,
    v_display_name,
    p_avatar_id,
    p_avatar_color
  )
  on conflict (id) do nothing;

  select profile.*
  into strict v_profile
  from public.profiles profile
  where profile.id = v_user_id;

  return v_profile;
end;
$$;

revoke all on function public.ensure_profile(text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.ensure_profile(text, text, text)
to authenticated;
