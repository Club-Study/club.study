delete from public.clubs
where id = '437ad7a7-8bc7-4b64-b583-6dd9f714569c'
  and created_by = '83560efe-b585-47a3-801e-30b2509487a0'
  and slug = 'prod-smoke-1783794306-24519'
  and name = 'Production application smoke 1783794306-24519'
  and description = 'Temporary production smoke club';

delete from auth.users
where (
  id = '83560efe-b585-47a3-801e-30b2509487a0'
  and email = 'owner-1783794306-24519@club-study.test'
)
or email = 'applicant-1783794306-24519@club-study.test';
