-- Turnover detail: type of turnover (Dribble Lost, Pass Bad, Violation:
-- Travel, etc.), picked as a second step after choosing the player.

alter table game_events add column if not exists turnover_type text;
