-- Who opened which game report, what they clicked, and how long the page
-- stayed visible. Written only by the server (/api/report-activity) for
-- club staff sessions; superadmin browsing is not logged.
create table public.report_activity (
  id bigint generated always as identity primary key,
  view_id uuid not null,
  staff_id uuid not null references public.club_staff(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  report_slug text not null check (report_slug ~ '^[a-z0-9-]{0,60}$'),
  action text not null check (action in ('view', 'click', 'leave')),
  target text check (char_length(target) <= 200),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  created_at timestamptz not null default now()
);
create index report_activity_game_idx on public.report_activity(game_id, created_at desc);
create index report_activity_staff_idx on public.report_activity(staff_id, created_at desc);
create index report_activity_created_idx on public.report_activity(created_at desc);
alter table public.report_activity enable row level security;
revoke all on public.report_activity from anon, authenticated;
grant all on public.report_activity to service_role;
notify pgrst, 'reload schema';
