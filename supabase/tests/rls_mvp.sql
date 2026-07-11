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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'same-name@example.com',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'profile-bootstrap@example.com',
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

select is(
  (
    select is_public
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'
  ),
  false,
  'new profiles are private by default'
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
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);

select lives_ok(
  $$ insert into public.profiles (id, display_name)
     values ('00000000-0000-0000-0000-000000000004', 'Owner') $$,
  'different users may share the same display name'
);

reset role;
insert into public.profiles (id, display_name)
values
  ('00000000-0000-0000-0000-000000000002', 'Member'),
  ('00000000-0000-0000-0000-000000000003', 'Outsider');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', true);

select is(
  (public.ensure_profile('  Profile Bootstrap  ', 'robot', '#123ABC')).display_name,
  'Profile Bootstrap',
  'authenticated users can bootstrap their own profile through the narrow RPC'
);

select is(
  (public.ensure_profile('Replacement Name', 'cat', '#654321')).display_name,
  'Profile Bootstrap',
  'profile bootstrap is idempotent and does not overwrite existing profile edits'
);

select is(
  (
    select avatar_id
    from public.profiles
    where id = '00000000-0000-0000-0000-000000000005'
  ),
  'robot',
  'profile bootstrap keeps the original avatar on repeated calls'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select public.create_club('RLS Club', 'rls-club', 'Private test club') $$,
  'create_club creates a private club atomically'
);

select throws_like(
  $$ select public.create_club('  rls CLUB  ', 'other-rls-club', null) $$,
  '%clubs_name_normalized_unique_idx%',
  'club names are globally unique after trimming and case folding'
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

select throws_like(
  $$ select public.schedule_arxiv_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-06'::date,
       '{}'::jsonb,
       null
     ) $$,
  '%permission denied%',
  'browser-authenticated users cannot write canonical arXiv metadata'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select lives_ok(
  $$ select public.import_arxiv_schedule(
       '00000000-0000-0000-0000-000000000002',
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
  'trusted service imports canonical arXiv metadata for a club member'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select public.schedule_manual_paper(
       (select id from public.clubs where slug = 'rls-club'),
       '2026-07-07'::date,
       jsonb_build_object(
         'title', 'Any Deadline',
         'authors', jsonb_build_array('A. Author'),
         'external_url', 'https://example.com/any-deadline'
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

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select throws_like(
  $$ select public.import_arxiv_schedule(
       '00000000-0000-0000-0000-000000000002',
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

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select throws_like(
  $$ select public.schedule_existing_paper(
       (select id from public.clubs where slug = 'rls-club'),
       current_setting('test.current_paper_id')::uuid,
       '2026-07-06'::date,
       null
     ) $$,
  '%club_paper_schedule_exact_unique_idx%',
  'the same club, paper, and deadline cannot be scheduled twice'
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
     where cps.id = '00000000-0000-0000-0000-000000000010' $$,
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
  '%admins can only soft-delete comments%',
  'club managers cannot edit another member comment body'
);

select lives_ok(
  $$ select public.soft_delete_comment(id)
     from public.comments
     where schedule_id = '00000000-0000-0000-0000-000000000010' $$,
  'owners can soft-delete comments in their clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(
  (select pg_catalog.count(*) from public.comments),
  0::bigint,
  'soft-deleted comment bodies are hidden from club members by RLS'
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
     select
       '00000000-0000-0000-0000-000000000010',
       p.id,
       '00000000-0000-0000-0000-000000000002',
       'note',
       1,
       '{"type":"area"}'::jsonb,
       'Wrong paper relation.',
       '#c084fc'
     from public.papers p
     where p.title = 'Owner Suggested Paper' $$,
  '%paper_annotations_schedule_paper_fkey%',
  'annotations must reference the paper belonging to their schedule'
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
  $$ select public.soft_delete_paper_annotation_reply(id)
     from public.paper_annotation_replies
     where annotation_id in (
       select id
       from public.paper_annotations
       where schedule_id = '00000000-0000-0000-0000-000000000010'
     ) $$,
  'owners can soft-delete annotation replies in their clubs'
);

select lives_ok(
  $$ select public.soft_delete_paper_annotation(id)
     from public.paper_annotations
     where schedule_id = '00000000-0000-0000-0000-000000000010' $$,
  'owners can soft-delete paper annotations in their clubs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(
  (select pg_catalog.count(*) from public.paper_annotations),
  0::bigint,
  'soft-deleted annotation bodies are hidden from club members by RLS'
);
select is(
  (select pg_catalog.count(*) from public.paper_annotation_replies),
  0::bigint,
  'soft-deleted annotation reply bodies are hidden from club members by RLS'
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
  'members can annotate an existing scheduled paper'
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
  'members can append another scheduled paper after annotations exist'
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
  1::bigint,
  'appending another schedule preserves the original annotation relation'
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
  'members cannot directly insert reading logs outside the atomic progress RPC'
);

select lives_ok(
  $$ select public.save_schedule_reading_progress(
       '00000000-0000-0000-0000-000000000010',
       10,
       10,
       'read'::public.paper_status
     ) $$,
  'members can atomically save absolute schedule progress'
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
  $$ select public.save_schedule_reading_progress(
       '00000000-0000-0000-0000-000000000010',
       10,
       10,
       'read'::public.paper_status
     ) $$,
  'retrying the same absolute schedule progress is idempotent'
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
    where schedule_id = '00000000-0000-0000-0000-000000000010'
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
    where schedule_id = '00000000-0000-0000-0000-000000000010'
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
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select throws_like(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Unsafe URL',
         'authors', jsonb_build_array('A. Author'),
         'external_url', 'javascript:alert(1)'
       ),
       null
     ) $$,
  '%valid HTTP(S) URL%',
  'manual papers reject non-HTTP URL schemes'
);

select throws_like(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Credential URL',
         'authors', jsonb_build_array('A. Author'),
         'external_url', 'https://user:secret@example.com/paper'
       ),
       null
     ) $$,
  '%without credentials%',
  'manual papers reject URL userinfo credentials'
);

select throws_like(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Invalid Authority',
         'authors', jsonb_build_array('A. Author'),
         'external_url', 'https://:/paper'
       ),
       null
     ) $$,
  '%valid HTTP(S) URL%',
  'manual papers reject invalid URL authorities'
);

select throws_like(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Dot Segment URL',
         'authors', jsonb_build_array('A. Author'),
         'external_url', 'https://example.com/a/../paper'
       ),
       null
     ) $$,
  '%valid HTTP(S) URL%',
  'manual paper RPCs reject non-canonical dot segments'
);

select throws_like(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Invalid Authors',
         'authors', jsonb_build_array('A. Author', 42),
         'external_url', 'https://example.com/invalid-authors'
       ),
       null
     ) $$,
  '%authors must be an array%',
  'manual paper authors must all be bounded strings'
);

select lives_ok(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'HTTP Personal Paper',
         'authors', jsonb_build_array('Reader One'),
         'external_url', '  HTTP://EXAMPLE.COM/CaseSensitive?Q=Value  '
       ),
       '2026-08-01'::date
     ) $$,
  'manual papers accept HTTP and normalize only scheme and authority'
);

select lives_ok(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Idempotent Retry',
         'authors', jsonb_build_array('Reader One'),
         'external_url', 'http://EXAMPLE.com:80/CaseSensitive?Q=Value#section'
       ),
       null
     ) $$,
  'manual paper retries reuse the normalized external URL atomically'
);

select is(
  (
    select pg_catalog.count(*)
    from public.personal_papers pp
    join public.papers p on p.id = pp.paper_id
    where pp.user_id = '00000000-0000-0000-0000-000000000002'
      and p.external_url = 'http://example.com/CaseSensitive?Q=Value'
  ),
  1::bigint,
  'normalized manual URL identity prevents duplicate personal items'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.add_personal_manual_paper(
       jsonb_build_object(
         'title', 'Independent Owner Metadata',
         'authors', jsonb_build_array('Different Author'),
         'external_url', 'http://example.com/CaseSensitive?Q=Value'
       ),
       null
     ) $$,
  'the same manual URL can be stored independently in another personal scope'
);

reset role;
select is(
  (
    select pg_catalog.count(*)
    from public.papers p
    where p.source_type = 'manual'::public.paper_source_type
      and p.external_url = 'http://example.com/CaseSensitive?Q=Value'
  ),
  2::bigint,
  'manual URL identity does not leak first-writer metadata across users'
);
select is(
  (
    select pg_catalog.count(distinct p.manual_scope)
    from public.papers p
    where p.source_type = 'manual'::public.paper_source_type
      and p.external_url = 'http://example.com/CaseSensitive?Q=Value'
  ),
  2::bigint,
  'manual URL deduplication is scoped to one private context'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select set_config(
  'test.personal_paper_id',
  (
    select pp.id::text
    from public.personal_papers pp
    join public.papers p on p.id = pp.paper_id
    where pp.user_id = '00000000-0000-0000-0000-000000000002'
      and p.external_url = 'http://example.com/CaseSensitive?Q=Value'
  ),
  false
);

select lives_ok(
  $$ select public.schedule_existing_paper(
       (select id from public.clubs where slug = 'rls-club'),
       (
         select pp.paper_id
         from public.personal_papers pp
         where pp.id = current_setting('test.personal_paper_id')::uuid
       ),
       '2026-08-03'::date,
       null
     ) $$,
  'sharing a personal manual paper into a club creates a scoped schedule copy'
);

reset role;
select isnt(
  (
    select cps.paper_id
    from public.club_paper_schedule cps
    where cps.week_start = '2026-08-03'::date
  ),
  (
    select pp.paper_id
    from public.personal_papers pp
    where pp.id = current_setting('test.personal_paper_id')::uuid
  ),
  'a club does not reuse the private personal manual-paper row'
);
select is(
  (
    select p.manual_scope
    from public.club_paper_schedule cps
    join public.papers p on p.id = cps.paper_id
    where cps.week_start = '2026-08-03'::date
  ),
  'club:' || (select id::text from public.clubs where slug = 'rls-club'),
  'the shared manual paper copy belongs to the destination club scope'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       2,
       5,
       'reading'::public.paper_status
     ) $$,
  'personal progress stores the first positive absolute delta'
);

select lives_ok(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       2,
       5,
       'reading'::public.paper_status
     ) $$,
  'retrying unchanged personal progress is idempotent'
);

select is(
  (
    select pg_catalog.count(*)
    from public.reading_sessions
    where personal_paper_id = current_setting('test.personal_paper_id')::uuid
  ),
  1::bigint,
  'an idempotent personal progress retry creates no duplicate session'
);

select lives_ok(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       5,
       5,
       'on_hold'::public.paper_status
     ) $$,
  'completed page progress may retain a non-read status'
);

select throws_like(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       4,
       5,
       'reading'::public.paper_status
     ) $$,
  '%cannot move backwards%',
  'absolute personal progress rejects regressions'
);

select throws_like(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       6,
       5,
       'reading'::public.paper_status
     ) $$,
  '%cannot exceed total pages%',
  'personal progress rejects current page above total pages'
);

select throws_like(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       5,
       100001,
       'reading'::public.paper_status
     ) $$,
  '%between 1 and 100000%',
  'personal progress rejects an unbounded total page count'
);

reset role;
select throws_like(
  $$ insert into public.reading_sessions (
       personal_paper_id,
       user_id,
       pages_read
     ) values (
       current_setting('test.personal_paper_id')::uuid,
       '00000000-0000-0000-0000-000000000002',
       100001
     ) $$,
  '%reading_sessions_pages_read_bounded_check%',
  'reading session rows enforce the bounded page delta invariant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$ select public.save_personal_reading_progress(
       current_setting('test.personal_paper_id')::uuid,
       5,
       5,
       'read'::public.paper_status
     ) $$,
  'personal progress atomically records the final read status'
);

select is(
  (
    select pg_catalog.sum(pages_read)
    from public.reading_sessions
    where personal_paper_id = current_setting('test.personal_paper_id')::uuid
  ),
  5::bigint,
  'personal reading sessions store only positive deltas to the absolute target'
);

select is(
  (
    select page_count
    from public.personal_papers
    where id = current_setting('test.personal_paper_id')::uuid
  ),
  5,
  'personal progress stores a context-scoped page count'
);

select is(
  (
    select status::text
    from public.personal_papers
    where id = current_setting('test.personal_paper_id')::uuid
  ),
  'read',
  'personal progress stores status atomically with its page count'
);

select is(
  (
    select pg_catalog.count(*)
    from public.reading_sessions
    where schedule_id = '00000000-0000-0000-0000-000000000010'
      and user_id = '00000000-0000-0000-0000-000000000002'
  ),
  1::bigint,
  'schedule absolute progress retries create no duplicate reading session'
);

select is(
  (
    select page_count
    from public.club_paper_schedule
    where id = '00000000-0000-0000-0000-000000000010'
  ),
  10,
  'schedule progress stores a context-scoped page count'
);

select throws_like(
  $$ select public.save_schedule_reading_progress(
       '00000000-0000-0000-0000-000000000010',
       9,
       10,
       'reading'::public.paper_status
     ) $$,
  '%cannot move backwards%',
  'absolute schedule progress rejects regressions'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select throws_like(
  $$ select public.import_arxiv_personal(
       '00000000-0000-0000-0000-000000000002',
       jsonb_build_object(
         'title', 'Invalid Trusted Authors',
         'authors', jsonb_build_array('Trusted Author', 42),
         'arxiv_id', '2402.54321',
         'abstract_url', 'https://arxiv.org/abs/2402.54321',
         'pdf_url', 'https://arxiv.org/pdf/2402.54321'
       ),
       null
     ) $$,
  '%authors must be an array%',
  'trusted arXiv imports still validate bounded string authors'
);

select lives_ok(
  $$ select public.import_arxiv_personal(
       '00000000-0000-0000-0000-000000000002',
       jsonb_build_object(
         'title', 'Trusted Personal arXiv Paper',
         'authors', jsonb_build_array('Trusted Author'),
         'arxiv_id', '2402.12345v3',
         'abstract_url', 'https://arxiv.org/abs/2402.12345',
         'pdf_url', 'https://arxiv.org/pdf/2402.12345'
       ),
       null
     ) $$,
  'service role can import trusted arXiv metadata into a personal list'
);

select lives_ok(
  $$ select public.consume_arxiv_rate_limit(
       '00000000-0000-0000-0000-000000000002'
     )
     from pg_catalog.generate_series(1, 30) $$,
  'service role can consume the fixed-window arXiv allowance atomically'
);

select throws_like(
  $$ select public.consume_arxiv_rate_limit(
       '00000000-0000-0000-0000-000000000002'
     ) $$,
  '%arXiv lookup rate limit exceeded%',
  'the thirty-first arXiv lookup in five minutes is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
update public.profiles
set is_public = true
where id = '00000000-0000-0000-0000-000000000002';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select is((select pg_catalog.count(*) from public.clubs), 0::bigint,
  'public personal activity does not expose private clubs');
select is((select pg_catalog.count(*) from public.club_paper_schedule), 0::bigint,
  'public personal activity does not expose private schedules');
select is((select pg_catalog.count(*) from public.reading_logs), 0::bigint,
  'public personal activity does not expose schedule reading logs');
select is((select pg_catalog.count(*) from public.schedule_paper_statuses), 0::bigint,
  'public personal activity does not expose schedule statuses');
select is(
  (
    select pg_catalog.count(*)
    from public.reading_sessions
    where schedule_id is not null
  ),
  0::bigint,
  'public personal activity does not expose schedule reading sessions'
);
select is((select pg_catalog.count(*) from public.personal_papers), 2::bigint,
  'public profiles expose only their personal paper list');
select is(
  (
    select pg_catalog.count(*)
    from public.reading_sessions
    where personal_paper_id is not null
  ),
  2::bigint,
  'public profiles expose personal-context reading sessions'
);
select is((select pg_catalog.count(*) from public.papers), 2::bigint,
  'outsiders can resolve papers reachable from a public personal list only');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
update public.profiles
set is_public = false
where id = '00000000-0000-0000-0000-000000000002';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select pg_catalog.count(*) from public.personal_papers), 0::bigint,
  'private profiles hide personal papers from outsiders');
select is((select pg_catalog.count(*) from public.reading_sessions), 0::bigint,
  'private profiles hide all reading sessions from outsiders');
select is((select pg_catalog.count(*) from public.papers), 0::bigint,
  'private profiles hide their papers from outsiders');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
create temp table test_deleted_parent_annotation as
with inserted as (
  insert into public.paper_annotations (
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
    '00000000-0000-0000-0000-000000000002',
    'note',
    2,
    '{"type":"area"}'::jsonb,
    'Parent deletion visibility test',
    '#c084fc'
  )
  returning id
)
select id from inserted;

insert into public.paper_annotation_replies (annotation_id, author_id, body)
select
  id,
  '00000000-0000-0000-0000-000000000002',
  'This reply must disappear with its parent.'
from test_deleted_parent_annotation;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.soft_delete_paper_annotation(
       (select id from test_deleted_parent_annotation)
     ) $$,
  'club managers can soft-delete an annotation without mutating its replies'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is(
  (
    select pg_catalog.count(*)
    from public.paper_annotation_replies
    where annotation_id = (select id from test_deleted_parent_annotation)
  ),
  0::bigint,
  'active replies are hidden when their parent annotation is deleted'
);
select throws_like(
  $$ insert into public.paper_annotation_replies (annotation_id, author_id, body)
     values (
       (select id from test_deleted_parent_annotation),
       '00000000-0000-0000-0000-000000000002',
       'Cannot reply after parent deletion.'
     ) $$,
  '%row-level security%',
  'members cannot reply to a soft-deleted annotation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select throws_like(
  $$ select token_hash from public.club_invites limit 1 $$,
  '%permission denied%',
  'club managers cannot read stored invite token hashes'
);

select throws_like(
  $$ update public.clubs set slug = 'changed-slug' where slug = 'rls-club' $$,
  '%permission denied%',
  'club slugs are not directly mutable by browser clients'
);

select throws_like(
  $$ delete from public.club_members
     where club_id = (select id from public.clubs where slug = 'rls-club')
       and user_id = '00000000-0000-0000-0000-000000000002' $$,
  '%permission denied%',
  'club membership mutations require an authorized RPC'
);

select throws_like(
  $$ delete from public.club_paper_schedule
     where id = '00000000-0000-0000-0000-000000000010' $$,
  '%permission denied%',
  'scheduled paper deletion requires an authorized RPC'
);

reset role;
select is(
  (
    select pg_catalog.count(*)
    from public.schedule_paper_statuses sps
    full join public.reading_logs rl
      on rl.schedule_id = sps.schedule_id
      and rl.user_id = sps.user_id
    where (sps.status = 'read'::public.paper_status)
      is distinct from (rl.id is not null)
  ),
  0::bigint,
  'schedule status and legacy reading-log representations stay synchronized'
);

select is(
  (
    select pg_catalog.count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee = 'anon'
  ),
  0::bigint,
  'anonymous users inherit no public table privileges'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  0::bigint,
  'anonymous users inherit no public RPC execution privileges'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_schedule_reading_progress(uuid,integer,integer,public.paper_status)',
    'EXECUTE'
  ),
  'authenticated users may execute the atomic schedule progress RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.toggle_read_status(uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the legacy read-toggle RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_paper_page_count(uuid,integer)',
    'EXECUTE'
  ),
  'authenticated users cannot mutate the legacy global paper page count'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.import_arxiv_personal(uuid,jsonb,date)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.import_arxiv_personal(uuid,jsonb,date)',
    'EXECUTE'
  ),
  'trusted arXiv imports are service-role-only'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.log_schedule_reading_session(uuid,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'public.set_schedule_paper_status(uuid,public.paper_status)',
    'EXECUTE'
  ),
  'service role cannot accidentally call legacy progress RPCs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select is(
  (select pg_catalog.count(*) from public.clubs),
  0::bigint,
  'club discovery does not broaden direct club-table access'
);

select is(
  (
    select pg_catalog.count(*)
    from public.list_discoverable_clubs()
    where name = 'RLS Club'
  ),
  1::bigint,
  'signed-in non-members can discover directory-safe club projections'
);

select is(
  (
    select viewer_role::text
    from public.list_discoverable_clubs()
    where name = 'RLS Club'
  ),
  null::text,
  'directory projection does not invent membership for an outsider'
);

select throws_like(
  $$ select pg_catalog.count(*) from public.club_join_requests $$,
  '%permission denied%',
  'applicants cannot read raw join-request rows'
);

create temp table test_outsider_application as
select *
from public.apply_to_club(
  (select id from public.list_discoverable_clubs() where name = 'RLS Club')
);

select is(
  (
    select application_status::text
    from public.list_discoverable_clubs()
    where name = 'RLS Club'
  ),
  'pending',
  'applicants see their own pending state through the directory projection'
);

select throws_like(
  $$ select public.apply_to_club(
       (select id from public.list_discoverable_clubs() where name = 'RLS Club')
     ) $$,
  '%application already pending%',
  'duplicate pending applications are rejected atomically'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);

select throws_like(
  $$ select * from public.list_club_join_requests(
       (select id from public.clubs where slug = 'rls-club')
     ) $$,
  '%only club owners and admins may review applications%',
  'ordinary members cannot list club applications'
);

select throws_like(
  $$ select public.review_club_join_request(
       (select id from test_outsider_application),
       'approved'
     ) $$,
  '%only club owners and admins may review applications%',
  'ordinary members cannot approve club applications'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select is(
  (
    select display_name
    from public.list_club_join_requests(
      (select id from public.clubs where slug = 'rls-club')
    )
    where request_id = (select id from test_outsider_application)
  ),
  'Outsider',
  'club owners can review the minimum applicant profile projection'
);

select throws_like(
  $$ select public.review_club_join_request(
       (select id from test_outsider_application),
       'maybe'
     ) $$,
  '%review decision must be approved or rejected%',
  'application review rejects unknown decisions'
);

select lives_ok(
  $$ select public.review_club_join_request(
       (select id from test_outsider_application),
       'rejected'
     ) $$,
  'club owners can reject pending applications'
);

select throws_like(
  $$ select public.review_club_join_request(
       (select id from test_outsider_application),
       'approved'
     ) $$,
  '%request is no longer pending%',
  'reviewed applications cannot be reviewed twice'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);

select is(
  (
    select application_status::text
    from public.list_discoverable_clubs()
    where name = 'RLS Club'
  ),
  'rejected',
  'rejected applicants see a retryable directory state'
);

create temp table test_outsider_retry as
select *
from public.apply_to_club(
  (select id from public.list_discoverable_clubs() where name = 'RLS Club')
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$ select public.review_club_join_request(
       (select id from test_outsider_retry),
       'approved'
     ) $$,
  'club owners can approve a retried application'
);

reset role;
select is(
  (
    select role::text
    from public.club_members
    where club_id = (select id from public.clubs where slug = 'rls-club')
      and user_id = '00000000-0000-0000-0000-000000000003'
  ),
  'member',
  'approval creates membership in the same transaction'
);

select is(
  (
    select status::text
    from public.club_join_requests
    where id = (select id from test_outsider_retry)
  ),
  'approved',
  'approval closes the pending request'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$ select public.set_club_member_role(
       (select id from public.clubs where slug = 'rls-club'),
       '00000000-0000-0000-0000-000000000002',
       'admin'::public.club_role
     ) $$,
  'owner can prepare an admin reviewer'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
create temp table test_admin_application as
select *
from public.apply_to_club(
  (select id from public.list_discoverable_clubs() where name = 'RLS Club')
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$ select public.review_club_join_request(
       (select id from test_admin_application),
       'approved'
     ) $$,
  'club admins can approve pending applications'
);

reset role;
select is(
  (
    select role::text
    from public.club_members
    where club_id = (select id from public.clubs where slug = 'rls-club')
      and user_id = '00000000-0000-0000-0000-000000000004'
  ),
  'member',
  'admin approval creates ordinary membership'
);

select is(
  (
    select pg_catalog.count(*)
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name = 'club_join_requests'
      and grantee in ('anon', 'authenticated')
  ),
  0::bigint,
  'join-request storage has no direct browser table grants'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.apply_to_club(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.apply_to_club(uuid)',
    'EXECUTE'
  ),
  'only authenticated users may execute the application RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.ensure_profile(text,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.ensure_profile(text,text,text)',
    'EXECUTE'
  ),
  'only authenticated users may execute the profile bootstrap RPC'
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
