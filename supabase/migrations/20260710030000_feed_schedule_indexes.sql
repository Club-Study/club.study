create index if not exists club_paper_schedule_week_start_idx
on public.club_paper_schedule (week_start);

create index if not exists club_paper_schedule_club_week_start_idx
on public.club_paper_schedule (club_id, week_start);
