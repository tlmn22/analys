-- Man to Man / Zone detail: which specific scheme was called (Full-court
-- man, 2-3, ...), picked as a second step after the button — no player
-- involved, these are team-level defensive calls.

alter table game_events add column if not exists man_to_man_type text;
alter table game_events add column if not exists zone_type text;
