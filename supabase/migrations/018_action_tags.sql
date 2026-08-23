-- Hustle Play -> "Good Bump" sub-type.
alter table game_events add column if not exists off_action_type text;
alter table game_events add column if not exists def_coverage_type text;
alter table game_events add column if not exists def_offball_type text;