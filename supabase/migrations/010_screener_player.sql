-- Screen Received detail: who set the screen (a teammate), captured
-- alongside the Reject/Use type — lets reports show screening
-- partnerships (who screens for whom), not just isolated events.

alter table game_events add column if not exists screener_player_id uuid references players(id);
alter table game_events add column if not exists screen_rcvd_type text;
