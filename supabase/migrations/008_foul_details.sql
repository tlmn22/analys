-- Foul detail (off_foul only for now): call-quality checkboxes + foul type,
-- picked as a second step after choosing the player.

alter table game_events add column if not exists foul_type text;
alter table game_events add column if not exists foul_fifty_fifty boolean not null default false;
alter table game_events add column if not exists foul_bad_call boolean not null default false;
alter table game_events add column if not exists foul_correct_call boolean not null default false;
