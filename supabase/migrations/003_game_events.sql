-- Phase 3: game_events — written by the Python "Game Tagger" desktop app,
-- readable later by the web app for box scores / reports.

create table game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  period int not null,
  clock_time numeric not null,   -- seconds remaining in the period (game clock)
  video_time numeric not null,   -- YouTube position in seconds (for seeking back)
  event_type text not null,      -- '2pt_made', 'turnover', 'sub', ...
  team_id uuid references teams(id),
  player_id uuid references players(id),
  assist_player_id uuid references players(id),
  points int,
  created_at timestamptz not null default now()
);

create index game_events_game_id_idx on game_events(game_id);

-- Same "deny-all to anon" pattern as the rest of the schema — only the
-- service-role client (web server or the Game Tagger app) touches this.
alter table game_events enable row level security;
