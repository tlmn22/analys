-- Press detail: which press scheme the defense called (Full Court Man to
-- Man, 1-2-2, 2-2-1, 1-3-1, Diamond, ...) — mirrors Man to Man/Zone's
-- typeDetail pattern (team-level, no player).

alter table game_events add column if not exists press_type text;
