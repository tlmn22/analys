-- Club-organized events (gym prep / fitness prep / team meetings / other) —
-- Attendance is tracked for all club_staff members, including players.
-- Only the superadmin or non-player staff of the event's club may edit it.
-- Game-tagging `players` remain separate from club member accounts.

do $$ begin
  create type club_event_type as enum ('gym_prep', 'fitness_prep', 'team_meeting', 'other');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late', 'excused');
exception
  when duplicate_object then null;
end $$;

create table if not exists club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  event_type club_event_type not null,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists club_event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references club_events(id) on delete cascade,
  club_staff_id uuid not null references club_staff(id) on delete cascade,
  status attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, club_staff_id)
);
