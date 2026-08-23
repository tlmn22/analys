-- Screen Set detail: type of screen (DHO, Handoff, Pop, Rescreen, Roll,
-- Stay, ...), picked as a second step after choosing the player.

alter table game_events add column if not exists screen_set_type text;

