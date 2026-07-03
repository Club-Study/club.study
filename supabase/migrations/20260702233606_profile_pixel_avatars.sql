alter table public.profiles
  add column avatar_id text not null default 'bookworm'
    check (avatar_id in ('bookworm', 'cat', 'dog', 'wizard', 'owl', 'robot')),
  add column avatar_color text not null default '#65a30d'
    check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');

grant insert (avatar_id, avatar_color) on public.profiles to authenticated;
grant update (avatar_id, avatar_color) on public.profiles to authenticated;
