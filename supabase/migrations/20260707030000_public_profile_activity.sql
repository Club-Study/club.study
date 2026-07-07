alter table public.profiles
  add column if not exists is_public boolean not null default true;

grant insert (is_public) on public.profiles to authenticated;
grant update (is_public) on public.profiles to authenticated;

create or replace function private.is_profile_public(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.is_public
  );
$$;

create or replace function private.can_view_profile_activity(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or private.is_profile_public(p_user_id);
$$;

create or replace function private.can_view_schedule_activity(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_schedule_member(p_schedule_id)
    or exists (
      select 1
      from public.schedule_paper_statuses sps
      where sps.schedule_id = p_schedule_id
        and private.can_view_profile_activity(sps.user_id)
    )
    or exists (
      select 1
      from public.reading_logs rl
      where rl.schedule_id = p_schedule_id
        and private.can_view_profile_activity(rl.user_id)
    );
$$;

create or replace function private.can_view_club_activity(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_club_member(p_club_id)
    or exists (
      select 1
      from public.club_paper_schedule cps
      where cps.club_id = p_club_id
        and private.can_view_schedule_activity(cps.id)
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
      and private.can_view_profile_activity(pp.user_id)
  )
  or exists (
    select 1
    from public.club_paper_schedule cps
    join public.club_members cm on cm.club_id = cps.club_id
    where cps.paper_id = p_paper_id
      and cm.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.club_paper_schedule cps
    join public.schedule_paper_statuses sps on sps.schedule_id = cps.id
    where cps.paper_id = p_paper_id
      and private.can_view_profile_activity(sps.user_id)
  )
  or exists (
    select 1
    from public.club_paper_schedule cps
    join public.reading_logs rl on rl.schedule_id = cps.id
    where cps.paper_id = p_paper_id
      and private.can_view_profile_activity(rl.user_id)
  );
$$;

drop policy if exists "profiles select own or shared club"
on public.profiles;

create policy "profiles select own shared club or public"
on public.profiles
for select
to authenticated
using (private.shares_club_with(id) or is_public);

drop policy if exists "clubs select members"
on public.clubs;

create policy "clubs select members or public activity"
on public.clubs
for select
to authenticated
using (private.can_view_club_activity(id));

drop policy if exists "club schedule select members"
on public.club_paper_schedule;

create policy "club schedule select members or public activity"
on public.club_paper_schedule
for select
to authenticated
using (private.can_view_schedule_activity(id));

drop policy if exists "reading logs select own"
on public.reading_logs;

create policy "reading logs select own or public profile"
on public.reading_logs
for select
to authenticated
using (private.can_view_profile_activity(user_id));

drop policy if exists "personal papers select own"
on public.personal_papers;

create policy "personal papers select own or public profile"
on public.personal_papers
for select
to authenticated
using (private.can_view_profile_activity(user_id));

drop policy if exists "schedule paper statuses select own"
on public.schedule_paper_statuses;

create policy "schedule paper statuses select own or public profile"
on public.schedule_paper_statuses
for select
to authenticated
using (private.can_view_profile_activity(user_id));

drop policy if exists "reading sessions select own"
on public.reading_sessions;

create policy "reading sessions select own or public profile"
on public.reading_sessions
for select
to authenticated
using (private.can_view_profile_activity(user_id));

drop policy if exists "papers select visible papers"
on public.papers;

create policy "papers select visible papers"
on public.papers
for select
to authenticated
using (private.can_access_paper(id));

revoke all on function private.is_profile_public(uuid) from public, anon, authenticated;
revoke all on function private.can_view_profile_activity(uuid) from public, anon, authenticated;
revoke all on function private.can_view_schedule_activity(uuid) from public, anon, authenticated;
revoke all on function private.can_view_club_activity(uuid) from public, anon, authenticated;
revoke all on function private.can_access_paper(uuid) from public, anon, authenticated;

grant execute on function private.is_profile_public(uuid) to authenticated;
grant execute on function private.can_view_profile_activity(uuid) to authenticated;
grant execute on function private.can_view_schedule_activity(uuid) to authenticated;
grant execute on function private.can_view_club_activity(uuid) to authenticated;
grant execute on function private.can_access_paper(uuid) to authenticated;
