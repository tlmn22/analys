-- Phase 4: video_url on games (so the web tagger knows what to embed) +
-- game_lineup (which 5 players are on the floor per team, per game).

alter table games add column if not exists video_url text;

create table game_lineup (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  slot int not null check (slot between 1 and 5),
  player_id uuid references players(id),
  unique (game_id, team_id, slot)
);

alter table game_lineup enable row level security;
