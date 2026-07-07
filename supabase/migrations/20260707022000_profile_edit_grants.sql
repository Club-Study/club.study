grant insert (
  id,
  display_name,
  avatar_id,
  avatar_color,
  bio
) on public.profiles to authenticated;

grant update (
  display_name,
  avatar_id,
  avatar_color,
  bio
) on public.profiles to authenticated;
