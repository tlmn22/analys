-- Archival import of vendor (Genius Sports / FIBA LiveStats) box score +
-- play-by-play JSON exports (e.g. previous seasons' tournament games that
-- were never tagged live through the Game Tagger). This is a separate
-- namespace from game_events: the vendor feed has no subjective analyst
-- judgment fields (shot quality, contested, screen types, ...) and isn't
-- tied to a video timeline, so it doesn't fit the tagging schema. Each
-- import_* row optionally links to the canonical teams/players tables via
-- a nullable *_id column once someone matches the vendor's name to a real
-- roster entry; until matched, the raw vendor name/stats are still usable
-- on their own for historical box scores.
-- Run this in the Supabase SQL editor.

create table import_games (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'geniussports',
  season_id uuid references seasons(id),
  game_date date,
  period int,
  period_length int,
  periods_max int,
  attendance int,
  home_team_name text not null,
  home_team_name_international text,
  home_score int,
  home_team_id uuid references teams(id),
  away_team_name text not null,
  away_team_name_international text,
  away_score int,
  away_team_id uuid references teams(id),
  raw jsonb not null,
  imported_at timestamptz not null default now()
);

-- One row per team per imported game (team_no matches the vendor's tno: 1
-- or 2). `stats` holds every tot_s* box score total as-is (~40 fields) —
-- kept as jsonb rather than one column each since these are read-only
-- historical numbers, not fields the app needs to query/filter on
-- individually.
create table import_teams (
  id uuid primary key default gen_random_uuid(),
  import_game_id uuid not null references import_games(id) on delete cascade,
  team_no int not null check (team_no in (1, 2)),
  name text not null,
  name_international text,
  short_name text,
  code text,
  logo_url text,
  coach text,
  score int,
  team_id uuid references teams(id),
  stats jsonb not null default '{}',
  unique (import_game_id, team_no)
);

-- One row per player per imported game. `stats` holds every s* box score
-- field (points, rebounds, minutes, efficiency, ...) as-is, same rationale
-- as import_teams.stats.
create table import_players (
  id uuid primary key default gen_random_uuid(),
  import_game_id uuid not null references import_games(id) on delete cascade,
  team_no int not null check (team_no in (1, 2)),
  pno int not null,
  shirt_number text,
  first_name text,
  last_name text,
  first_name_international text,
  last_name_international text,
  position text,
  starter boolean not null default false,
  photo_url text,
  player_id uuid references players(id),
  stats jsonb not null default '{}',
  unique (import_game_id, team_no, pno)
);

-- Raw play-by-play feed, one row per vendor pbp entry. qualifier is the
-- vendor's free-form tag list (e.g. "pointsinthepaint", "2freethrow").
create table import_pbp_events (
  id uuid primary key default gen_random_uuid(),
  import_game_id uuid not null references import_games(id) on delete cascade,
  action_number int not null,
  period int not null,
  period_type text,
  game_clock text,
  clock text,
  team_no int,
  pno int,
  player_name text,
  shirt_number text,
  action_type text not null,
  sub_type text,
  qualifier text[] not null default '{}',
  success boolean not null default false,
  scoring int not null default 0,
  score_home int,
  score_away int,
  lead int,
  previous_action int,
  unique (import_game_id, action_number)
);

-- Shot chart: court x/y per attempt (from tm.X.shot[]), keyed back to the
-- pbp row via action_number so make/miss and shot type aren't duplicated.
create table import_shots (
  id uuid primary key default gen_random_uuid(),
  import_game_id uuid not null references import_games(id) on delete cascade,
  action_number int not null,
  team_no int not null check (team_no in (1, 2)),
  pno int not null,
  period int,
  made boolean not null,
  x numeric not null,
  y numeric not null,
  action_type text,
  sub_type text,
  unique (import_game_id, action_number)
);

create index import_teams_import_game_id_idx on import_teams(import_game_id);
create index import_players_import_game_id_idx on import_players(import_game_id);
create index import_pbp_events_import_game_id_idx on import_pbp_events(import_game_id);
create index import_shots_import_game_id_idx on import_shots(import_game_id);
create index import_players_player_id_idx on import_players(player_id);
create index import_teams_team_id_idx on import_teams(team_id);

alter table import_games enable row level security;
alter table import_teams enable row level security;
alter table import_players enable row level security;
alter table import_pbp_events enable row level security;
alter table import_shots enable row level security;
