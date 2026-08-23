-- Phase 6: who was defending the shot (2pt_made/2pt_miss/3pt_made/3pt_miss) —
-- lets reports show per-defender opponent shooting stats.

alter table game_events add column if not exists defender_player_id uuid references players(id);
