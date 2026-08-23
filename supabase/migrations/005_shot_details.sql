-- Phase 5: detailed shot tagging for 2pt_made/2pt_miss/3pt_made/3pt_miss —
-- shot type, boolean modifiers, a 1-10 quality rating, and court location.

alter table game_events add column if not exists shot_type text;
alter table game_events add column if not exists and_one boolean not null default false;
alter table game_events add column if not exists assisted boolean not null default false;
alter table game_events add column if not exists bad_miss boolean not null default false;
alter table game_events add column if not exists contested_close boolean not null default false;
alter table game_events add column if not exists late_clock boolean not null default false;
alter table game_events add column if not exists lightly_contested boolean not null default false;
alter table game_events add column if not exists unassisted boolean not null default false;
alter table game_events add column if not exists uncontested boolean not null default false;
alter table game_events add column if not exists wide_open boolean not null default false;
alter table game_events add column if not exists shot_quality int check (shot_quality between 1 and 10);
alter table game_events add column if not exists shot_x numeric;
alter table game_events add column if not exists shot_y numeric;
