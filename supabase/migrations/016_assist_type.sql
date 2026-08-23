-- Assist detail: type of assist (Hockey, Led to Free Throws, Pass, Screen,
-- Good move, ...), picked as a second step after choosing the passer.

alter table game_events add column if not exists assist_type text;
