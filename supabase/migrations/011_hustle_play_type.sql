-- Hustle Play detail: type of hustle play (Diving for Ball, Offensive
-- Rebound Effort, Defensive Rebound Effort, Good Bump, ...), picked as a
-- second step after choosing the player.

alter table game_events add column if not exists hustle_play_type text;
