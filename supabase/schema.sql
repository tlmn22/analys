-- Basketball Analytic System — full schema (Phase 1 + Phase 2 combined)
-- Run this in the Supabase SQL editor for a FRESH project (Project -> SQL
-- Editor -> New query). If your project already has the Phase 1 schema
-- applied, use supabase/migrations/002_season_rosters_games.sql instead.

create extension if not exists pgcrypto;

create type player_position as enum ('PG', 'SG', 'SF', 'PF', 'C');
create type game_type as enum (
  'league', 'division', 'non_conference', 'tournament',
  'playoff', 'pre_season', 'scrimmage'
);
create type club_staff_role as enum ('owner', 'manager', 'head_coach', 'assistant_coach', 'player');
create type club_event_type as enum ('gym_prep', 'fitness_prep', 'team_meeting', 'other');
create type attendance_status as enum ('present', 'absent', 'late', 'excused', 'sick');

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  gender text not null check (gender in ('male', 'female')),
  created_at timestamptz not null default now()
);

-- Standalone club registry (organization/sponsor info) — independent of
-- teams for now, not linked via a foreign key.
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  sponsor_name text,
  sponsor_logo_url text,
  created_at timestamptz not null default now()
);

-- A club's people (owner/manager/head coach/assistant coach/player) —
-- Non-player members can log in to edit their own club's event attendance
-- and descriptions. Player accounts are attendance subjects, not editors.
-- password_hash is a salted scrypt hash (see lib/password.ts), never a
-- plaintext password. The "player" role here is a lightweight, unverified
-- account distinct from the `players` table used for game tagging/rosters
-- — no link between the two.
create table club_staff (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  password_hash text not null,
  role club_staff_role not null,
  created_at timestamptz not null default now()
);

-- Club-organized events (gym prep / fitness prep / team meetings / other) —
-- Attendance includes all club_staff members, including players. Editing
-- is restricted to the superadmin or non-player staff of the event's club.
-- Game-tagging `players` remain separate from club member accounts.
create table club_events (
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

create table club_event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references club_events(id) on delete cascade,
  club_staff_id uuid not null references club_staff(id) on delete cascade,
  status attendance_status not null default 'absent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, club_staff_id)
);

create table seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Players exist independently of any team. Team membership is configured
-- per season via season_teams + rosters below.
create table players (
  id uuid primary key default gen_random_uuid(),
  photo_url text,
  first_name text not null,
  last_name text not null,
  active boolean not null default true,
  position player_position not null,
  created_at timestamptz not null default now()
);

-- Which teams are registered to a season.
create table season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);

-- Which players are on a season_team's roster, with their jersey number
-- for that team/season.
create table rosters (
  id uuid primary key default gen_random_uuid(),
  season_team_id uuid not null references season_teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  number int not null,
  created_at timestamptz not null default now(),
  unique (season_team_id, player_id)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  home_team_id uuid not null references teams(id),
  home_team_color text,
  visitor_team_id uuid not null references teams(id),
  visitor_team_color text,
  location text,
  game_type game_type not null default 'league',
  game_date timestamptz,
  video_url text,
  created_at timestamptz not null default now()
);

-- Play-by-play events tagged by the web Game Tagger (app/admin/tag).
create table game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  period int not null,
  clock_time numeric not null,   -- seconds remaining in the period (game clock)
  video_time numeric not null,   -- YouTube position in seconds (for seeking back)
  event_type text not null,      -- '2pt_made', 'turnover', 'sub', ...
  decision_quality text check (decision_quality in ('good', 'bad')),
  team_id uuid references teams(id),
  player_id uuid references players(id),
  assist_player_id uuid references players(id),
  points int,
  -- Shot detail (2pt_made/2pt_miss/3pt_made/3pt_miss only):
  shot_type text,
  and_one boolean not null default false,
  assisted boolean not null default false,
  bad_miss boolean not null default false,
  contested_close boolean not null default false,
  late_clock boolean not null default false,
  lightly_contested boolean not null default false,
  unassisted boolean not null default false,
  uncontested boolean not null default false,
  wide_open boolean not null default false,
  shot_quality int check (shot_quality between 1 and 10),
  shot_x numeric,
  shot_y numeric,
  defender_player_id uuid references players(id),
  -- Assist detail:
  assist_type text,
  -- Turnover detail (turnover only):
  turnover_type text,
  -- Foul detail (off_foul only, for now):
  foul_type text,
  foul_fifty_fifty boolean not null default false,
  foul_bad_call boolean not null default false,
  foul_correct_call boolean not null default false,
  -- Screen Set detail:
  screen_set_type text,
  screen_target_player_id uuid references players(id),
  -- Screen Received detail:
  screener_player_id uuid references players(id),
  screen_rcvd_type text,
  -- Hustle Play detail:
  hustle_play_type text,
  -- Set Offense detail (name of the offensive set called; see
  -- game_offense_sets below for the per-game growable name list):
  set_offense_name text,
  -- BLOB/SLOB detail (named inbound play + outcome, for success-rate
  -- reporting per play):
  blob_play_name text,
  blob_outcome text,
  slob_play_name text,
  slob_outcome text,
  -- Man to Man / Zone / Press detail (team-level, no player):
  man_to_man_type text,
  zone_type text,
  press_type text,
  -- Named offensive actions / defensive coverage calls (team-level, no
  -- player):
  off_action_type text,
  def_coverage_type text,
  def_offball_type text,
  -- Physical Contact detail (two players + who won):
  physical_contact_type text,
  physical_contact_second_player_id uuid references players(id),
  physical_contact_winner_player_id uuid references players(id),
  -- Boxout detail (Good/Bad call quality, either team):
  boxout_type text,
  -- Marks a game-turning moment, set only via editing an already-tagged
  -- event — the analyst's own judgment call, not derived from anything:
  key_event boolean not null default false,
  created_at timestamptz not null default now()
);

-- Which 5 players are on the floor for each team, per game.
create table game_lineup (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  slot int not null check (slot between 1 and 5),
  player_id uuid references players(id),
  unique (game_id, team_id, slot)
);

-- Named play list for a game, built up as the analyst tags ("Other Set
-- Offense"/"Other BLOB"/"Other SLOB" adds a new name here) — every team
-- runs different named plays, so this isn't a fixed global taxonomy like
-- turnover/foul types. `category` separates Set Offense/BLOB/SLOB lists
-- (baseline vs sideline inbounds typically call different sets).
create table game_offense_sets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  category text not null default 'set_offense',
  name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, category, name)
);

create index rosters_season_team_id_idx on rosters(season_team_id);
create index rosters_player_id_idx on rosters(player_id);
create index season_teams_season_id_idx on season_teams(season_id);
create index games_season_id_idx on games(season_id);
create index game_events_game_id_idx on game_events(game_id);
create index game_lineup_game_id_idx on game_lineup(game_id);
create index game_offense_sets_game_id_idx on game_offense_sets(game_id);

-- All access goes through the server-side service-role client, so RLS is
-- enabled with no policies: anon/authenticated keys get zero access.
alter table teams enable row level security;
alter table seasons enable row level security;
alter table players enable row level security;
alter table season_teams enable row level security;
alter table rosters enable row level security;
alter table games enable row level security;
alter table game_events enable row level security;
alter table game_lineup enable row level security;
alter table game_offense_sets enable row level security;

-- Storage: create a public "images" bucket for team logos / player photos.
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "Public read access to images"
  on storage.objects for select
  using (bucket_id = 'images');
