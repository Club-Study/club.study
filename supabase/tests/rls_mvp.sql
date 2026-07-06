begin;

create extension if not exists pgtap;

select no_plan();

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner@example.com',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'member@example.com',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'outsider@example.com',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_like(
  $$ select count(*) from public.clubs $$,
  '%permission denied%',
  'signed-out users cannot query private clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ insert into public.profiles (id, display_name)
     values ('00000000-0000-0000-0000-000000000001', 'Owner') $$,
  'users can insert their own profile'
);

select throws_like(
  $$ update public.profiles
     set created_at = now() - interval '1 day'
     where id = '00000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'users cannot directly mutate profile audit fields'
);

select throws_like(
  $$ insert into public.profiles (id, display_name)
     values ('00000000-0000-0000-0000-000000000002', 'Not mine') $$,
  '%row-level security%',
  'users cannot insert another user profile'
);

reset role;
insert into public.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-000000000002', 'Member'),
  ('00000000-0000-0000-0000-000000000003', 'Outsider');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select public.create_club('RLS Club', 'rls-club', 'Private test club') $$,
  'create_club creates a private club atomically'
);

reset role;
select is(
  (
    select role::text
    from public.club_members
    where user_id = '00000000-0000-0000-0000-000000000001'
  ),
  'owner',
  'club creator becomes owner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.clubs),
  0::bigint,
  'non-members cannot read private clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

create temp table test_invite_link (
  id uuid not null,
  token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null
) on commit drop;

select lives_ok(
  $$ insert into test_invite_link
     select * from public.create_invite_link(
       (select id from public.clubs where slug = 'rls-club'),
       now() + interval '1 day'
     ) $$,
  'owners can create invite links'
);

select throws_like(
  $$ insert into public.club_invites (club_id, token_hash, created_by, expires_at)
     select
       id,
       encode(extensions.digest('direct-token', 'sha256'), 'hex'),
       '00000000-0000-0000-0000-000000000001',
       now() + interval '1 day'
     from public.clubs
     where slug = 'rls-club' $$,
  '%permission denied%',
  'owners cannot directly insert invite rows'
);

select throws_like(
  $$ update public.club_invites
     set status = 'revoked'
     where id = (select id from test_invite_link limit 1) $$,
  '%permission denied%',
  'owners cannot directly mutate invite rows'
);

reset role;
select is(
  (
    select count(*)
    from public.club_invites ci
    join public.clubs c on c.id = ci.club_id
    where c.slug = 'rls-club'
      and ci.status = 'pending'
  ),
  1::bigint,
  'create_invite_link stores one pending invite'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.accept_invite((select token from test_invite_link limit 1)) $$,
  'signed-in users can accept a valid invite'
);

reset role;
select is(
  (
    select role::text
    from public.club_members
    where user_id = '00000000-0000-0000-0000-000000000002'
  ),
  'member',
  'accepted invite creates member membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_like(
  $$ select public.accept_invite((select token from test_invite_link limit 1)) $$,
  '%invite is no longer pending%',
  'duplicate invite acceptance fails'
);

select is(
  (select count(*) from public.clubs),
  1::bigint,
  'members can read their private club'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.club_members),
  0::bigint,
  'non-members cannot read club membership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.clubs
     set created_by = '00000000-0000-0000-0000-000000000003'
     where slug = 'rls-club' $$,
  '%permission denied%',
  'owners cannot directly mutate club ownership fields'
);

select throws_like(
  $$ update public.club_members
     set created_at = now() - interval '1 day'
     where user_id = '00000000-0000-0000-0000-000000000001' $$,
  '%permission denied%',
  'owners cannot directly mutate membership audit fields'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.schedule_arxiv_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-06'::date,
       jsonb_build_object(
         'title', 'Attention Is All You Need',
         'authors', jsonb_build_array('Ashish Vaswani'),
         'abstract', 'A test abstract.',
         'arxiv_id', '2401.12345v2',
         'doi', '10.0000/example',
         'license', 'arXiv.org perpetual, non-exclusive license',
         'abstract_url', 'https://arxiv.org/abs/2401.12345',
         'pdf_url', 'https://arxiv.org/pdf/2401.12345',
         'published_at', '2024-01-01T00:00:00Z',
         'updated_at', '2024-01-02T00:00:00Z'
       ),
       'Read for Monday'
     ) $$,
  'members can schedule an arXiv paper for a Monday'
);

select lives_ok(
  $$ select public.schedule_arxiv_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-07'::date,
       jsonb_build_object(
         'title', 'Bad Weekday',
         'authors', jsonb_build_array('A. Author'),
         'arxiv_id', '2401.99999',
         'abstract_url', 'https://arxiv.org/abs/2401.99999',
         'pdf_url', 'https://arxiv.org/pdf/2401.99999'
       ),
       null
     ) $$,
  'scheduled paper deadlines can be any date'
);

reset role;
update public.club_paper_schedule cps
set id = '00000000-0000-0000-0000-000000000010'
from public.clubs c
where c.id = cps.club_id
  and c.slug = 'rls-club'
  and cps.week_start = '2026-07-06'::date;

select set_config(
  'test.current_paper_id',
  (
    select paper_id::text
    from public.club_paper_schedule
    where id = '00000000-0000-0000-0000-000000000010'
  ),
  false
);

select is(
  (
    select p.pdf_url
    from public.papers p
    where p.arxiv_id = '2401.12345'
  ),
  'https://arxiv.org/pdf/2401.12345',
  'arXiv paper stores a direct arXiv PDF URL only'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_like(
  $$ select public.schedule_arxiv_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-13'::date,
       jsonb_build_object(
         'title', 'Mismatched arXiv Links',
         'authors', jsonb_build_array('A. Author'),
         'arxiv_id', '2401.77777v2',
         'abstract_url', 'https://arxiv.org/abs/2401.77777',
         'pdf_url', 'https://arxiv.org/pdf/2401.77777v2'
       ),
       null
     ) $$,
  '%arxiv links must match%',
  'arXiv PDF URLs must match canonical non-versioned arxiv_id'
);

select throws_like(
  $$ insert into public.club_paper_schedule (
       club_id,
       paper_id,
       week_start,
       created_by
     )
     select
       c.id,
       p.id,
       '2026-07-13'::date,
       '00000000-0000-0000-0000-000000000002'
     from public.clubs c
     cross join public.papers p
     where c.slug = 'rls-club'
     limit 1 $$,
  '%permission denied%',
  'members cannot directly insert schedule rows outside the scheduling RPC'
);

select throws_like(
  $$ update public.club_paper_schedule
     set created_by = '00000000-0000-0000-0000-000000000003'
     where id = '00000000-0000-0000-0000-000000000010' $$,
  '%permission denied%',
  'members cannot directly mutate schedule rows outside the scheduling RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.schedule_manual_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-06'::date,
       jsonb_build_object(
         'title', 'Owner Suggested Paper',
         'authors', jsonb_build_array('Owner Author'),
         'external_url', 'https://example.com/owner-paper'
       ),
       null
     ) $$,
  'members can schedule another paper with the same deadline'
);

select is(
  (
    select count(*)
    from public.club_paper_schedule
    where club_id = (select id from public.clubs where slug = 'rls-club')
      and week_start = '2026-07-06'::date
  ),
  2::bigint,
  'schedules are not unique per club deadline'
);

reset role;
select set_config(
  'test.current_paper_id',
  (
    select paper_id::text
    from public.club_paper_schedule
    where id = '00000000-0000-0000-0000-000000000010'
  ),
  false
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.club_paper_schedule),
  0::bigint,
  'non-members cannot read club schedules'
);

select throws_like(
  $$ select public.schedule_manual_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-13'::date,
       jsonb_build_object(
         'title', 'External Paper',
         'authors', jsonb_build_array('Outside Author'),
         'external_url', 'https://example.com/paper'
       ),
       null
     ) $$,
  '%only club members can schedule papers%',
  'non-members cannot schedule papers'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ insert into public.comments (schedule_id, author_id, body)
     select
       cps.id,
       '00000000-0000-0000-0000-000000000002',
       'Looking forward to discussing this.'
     from public.club_paper_schedule cps
     join public.clubs c on c.id = cps.club_id
     where c.slug = 'rls-club'
       and cps.week_start = '2026-07-06'::date $$,
  'members can comment on scheduled papers'
);

select lives_ok(
  $$ update public.comments
     set body = 'Updated by author.'
     where author_id = '00000000-0000-0000-0000-000000000002' $$,
  'authors can edit their own comment body'
);

select throws_like(
  $$ update public.comments
     set author_id = '00000000-0000-0000-0000-000000000001'
     where author_id = '00000000-0000-0000-0000-000000000002' $$,
  '%permission denied%',
  'authors cannot rewrite comment ownership'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.comments),
  0::bigint,
  'non-members cannot read schedule comments'
);

select throws_like(
  $$ insert into public.comments (schedule_id, author_id, body)
     values (
       '00000000-0000-0000-0000-000000000010',
       '00000000-0000-0000-0000-000000000003',
       'No access.'
     ) $$,
  '%row-level security%',
  'non-members cannot comment on scheduled papers'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select throws_like(
  $$ update public.comments
     set body = 'Owner body edit.'
     where schedule_id = '00000000-0000-0000-0000-000000000010' $$,
  '%owners can only soft-delete comments%',
  'owners cannot edit another member comment body'
);

select lives_ok(
  $$ update public.comments
     set deleted_at = now()
     where schedule_id = '00000000-0000-0000-0000-000000000010' $$,
  'owners can soft-delete comments in their clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ insert into public.paper_annotations (
       schedule_id,
       paper_id,
       author_id,
       kind,
       page_number,
       position,
       quote,
       body,
       color
     )
     select
       cps.id,
       cps.paper_id,
       '00000000-0000-0000-0000-000000000002',
       'question',
       1,
       '{"type":"text","boundingRect":{"left":10,"top":10,"width":20,"height":3},"rects":[{"left":10,"top":10,"width":20,"height":3}]}'::jsonb,
       'Important quote',
       'What does this imply?',
       '#60a5fa'
     from public.club_paper_schedule cps
     where cps.id = '00000000-0000-0000-0000-000000000010' $$,
  'members can create paper annotations'
);

select lives_ok(
  $$ update public.paper_annotations
     set body = 'Updated annotation question.'
     where author_id = '00000000-0000-0000-0000-000000000002' $$,
  'authors can edit their own annotation body'
);

select lives_ok(
  $$ insert into public.paper_annotation_replies (annotation_id, author_id, body)
     select
       pa.id,
       '00000000-0000-0000-0000-000000000002',
       'Follow-up reply.'
     from public.paper_annotations pa
     where pa.author_id = '00000000-0000-0000-0000-000000000002'
     limit 1 $$,
  'members can reply to paper annotations'
);

select set_config(
  'test.current_annotation_id',
  (
    select id::text
    from public.paper_annotations
    where author_id = '00000000-0000-0000-0000-000000000002'
    limit 1
  ),
  false
);

select lives_ok(
  $$ update public.paper_annotation_replies
     set body = 'Updated reply.'
     where author_id = '00000000-0000-0000-0000-000000000002' $$,
  'authors can edit their own annotation replies'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*) from public.paper_annotations),
  0::bigint,
  'non-members cannot read paper annotations'
);

select throws_like(
  $$ insert into public.paper_annotations (
       schedule_id,
       paper_id,
       author_id,
       kind,
       page_number,
       position,
       body,
       color
     )
     values (
       '00000000-0000-0000-0000-000000000010',
       current_setting('test.current_paper_id')::uuid,
       '00000000-0000-0000-0000-000000000003',
       'note',
       1,
       '{"type":"area","boundingRect":{"left":10,"top":10,"width":20,"height":20},"rects":[{"left":10,"top":10,"width":20,"height":20}]}'::jsonb,
       'No access.',
       '#c084fc'
     ) $$,
  '%row-level security%',
  'non-members cannot create paper annotations'
);

select throws_like(
  $$ insert into public.paper_annotation_replies (annotation_id, author_id, body)
     values (
       current_setting('test.current_annotation_id')::uuid,
       '00000000-0000-0000-0000-000000000003',
       'No access.'
     ) $$,
  '%row-level security%',
  'non-members cannot reply to paper annotations'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ update public.paper_annotation_replies
     set deleted_at = now()
     where annotation_id in (
       select id
       from public.paper_annotations
       where schedule_id = '00000000-0000-0000-0000-000000000010'
     ) $$,
  'owners can soft-delete annotation replies in their clubs'
);

select lives_ok(
  $$ update public.paper_annotations
     set deleted_at = now()
     where schedule_id = '00000000-0000-0000-0000-000000000010' $$,
  'owners can soft-delete paper annotations in their clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ insert into public.paper_annotations (
       schedule_id,
       paper_id,
       author_id,
       kind,
       page_number,
       position,
       quote,
       body,
       color
     )
     select
       cps.id,
       cps.paper_id,
       '00000000-0000-0000-0000-000000000002',
       'highlight',
       1,
       '{"type":"text","boundingRect":{"left":20,"top":20,"width":10,"height":3},"rects":[{"left":20,"top":20,"width":10,"height":3}]}'::jsonb,
       'Old scheduled paper quote',
       null,
       '#facc15'
     from public.club_paper_schedule cps
     where cps.id = '00000000-0000-0000-0000-000000000010' $$,
  'members can annotate the current scheduled paper before replacement'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.schedule_manual_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-06'::date,
       jsonb_build_object(
         'title', 'Replacement Paper',
         'authors', jsonb_build_array('Replacement Author'),
         'external_url', 'https://example.com/replacement-paper'
       ),
       null
     ) $$,
  'owners can replace a scheduled paper after annotations exist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(
  (
    select count(*)
    from public.paper_annotations pa
    join public.club_paper_schedule cps on cps.id = pa.schedule_id
    where pa.schedule_id = '00000000-0000-0000-0000-000000000010'
      and pa.paper_id = cps.paper_id
      and pa.deleted_at is null
  ),
  0::bigint,
  'annotations for an old paper do not match the current scheduled paper'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_like(
  $$ insert into public.reading_logs (schedule_id, user_id)
     values (
       '00000000-0000-0000-0000-000000000010',
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '%permission denied%',
  'members cannot directly insert reading logs outside the toggle RPC'
);

select lives_ok(
  $$ select public.toggle_read_status(
       (
         select cps.id
         from public.club_paper_schedule cps
         join public.clubs c on c.id = cps.club_id
         where c.slug = 'rls-club'
           and cps.week_start = '2026-07-06'::date
       ),
       true
     ) $$,
  'members can mark scheduled papers read'
);

select is(
  (select count(*) from public.reading_logs),
  1::bigint,
  'users can read their own raw reading logs'
);

reset role;
update public.reading_logs
set read_at = '2026-01-02 00:00:00+00'
where schedule_id = '00000000-0000-0000-0000-000000000010'
  and user_id = '00000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.toggle_read_status(
       '00000000-0000-0000-0000-000000000010',
       true
     ) $$,
  'marking an already-read paper read is idempotent'
);

select is(
  (
    select read_at
    from public.reading_logs
    where schedule_id = '00000000-0000-0000-0000-000000000010'
      and user_id = '00000000-0000-0000-0000-000000000002'
  ),
  '2026-01-02 00:00:00+00'::timestamptz,
  'duplicate mark read preserves the original reading activity date'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*) from public.reading_logs),
  0::bigint,
  'club owners cannot read another member raw reading logs'
);

select is(
  (
    select total_members
    from public.get_club_schedule_progress(
      (select id from public.clubs where slug = 'rls-club')
    )
  ),
  2::bigint,
  'club progress exposes aggregate member count'
);

select is(
  (
    select read_count
    from public.get_club_schedule_progress(
      (select id from public.clubs where slug = 'rls-club')
    )
  ),
  1::bigint,
  'club progress exposes aggregate read count'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
create temp table test_revoked_invite as
select *
from public.create_invite_link(
  (select id from public.clubs where slug = 'rls-club'),
  now() + interval '1 day'
);

select lives_ok(
  $$ select public.revoke_invite_link((select id from test_revoked_invite limit 1)) $$,
  'owners can revoke pending invite links through RPC'
);

reset role;
select is(
  (
    select status::text
    from public.club_invites
    where id = (select id from test_revoked_invite limit 1)
  ),
  'revoked',
  'revoke_invite_link marks invite revoked'
);

insert into public.club_invites (
  club_id,
  token_hash,
  created_by,
  created_at,
  expires_at
)
select
  id,
  encode(extensions.digest('expired-token', 'sha256'), 'hex'),
  '00000000-0000-0000-0000-000000000001',
  now() - interval '2 days',
  now() - interval '1 minute'
from public.clubs
where slug = 'rls-club';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_like(
  $$ select public.accept_invite('expired-token') $$,
  '%invite has expired%',
  'expired invites cannot be accepted'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_like(
  $$ select public.create_club('Anon Club', 'anon-club', null) $$,
  '%permission denied%',
  'anonymous users cannot execute authenticated RPCs'
);

reset role;
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'papers'
      and column_name in ('storage_path', 'file_path', 'storage_bucket')
  ),
  'arXiv MVP schema has no paper storage columns'
);

select * from finish();

rollback;
