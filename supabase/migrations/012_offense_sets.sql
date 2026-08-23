-- Set Offense detail: the offensive play/set name a team calls (e.g.
-- "Diamond", "Motion"). Unlike the other detail lists (turnover types,
-- foul types, ...) this one isn't a fixed taxonomy — every team runs
-- different named sets, so the list is built up per-game as the analyst
-- tags ("Other Set Offense" adds a new name to this game's list).

create table if not exists game_offense_sets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, name)
);

create index if not exists game_offense_sets_game_id_idx on game_offense_sets(game_id);

alter table game_offense_sets enable row level security;

alter table game_events add column if not exists set_offense_name text;
