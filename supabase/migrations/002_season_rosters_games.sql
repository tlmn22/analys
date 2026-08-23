-- Phase 2: season-scoped rosters + games
-- Run this in the Supabase SQL editor against the project that already has
-- schema.sql applied.

-- players: team is no longer fixed on the player. Jersey number moves to
-- the roster entry (team+season specific). Starter is dropped for now.
alter table players drop constraint if exists players_team_id_fkey;
drop index if exists players_team_id_idx;
alter table players drop column if exists team_id;
alter table players drop column if exists number;
alter table players drop column if exists starter;

-- season_teams: which teams are registered to a season
create table season_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (season_id, team_id)
);

-- rosters: which players are on a season_team's roster, with their number
-- for that team/season
create table rosters (
  id uuid primary key default gen_random_uuid(),
  season_team_id uuid not null references season_teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  number int not null,
  created_at timestamptz not null default now(),
  unique (season_team_id, player_id)
);

create type game_type as enum (
  'league', 'division', 'non_conference', 'tournament',
  'playoff', 'pre_season', 'scrimmage'
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
  created_at timestamptz not null default now()
);

create index rosters_season_team_id_idx on rosters(season_team_id);
create index rosters_player_id_idx on rosters(player_id);
create index season_teams_season_id_idx on season_teams(season_id);
create index games_season_id_idx on games(season_id);

alter table season_teams enable row level security;
alter table rosters enable row level security;
alter table games enable row level security;
