-- Screen Set detail: which player the screen was set for (the ball
-- handler/cutter it freed up) — mirrors screener_player_id, which already
-- records the reverse relationship (who set the screen) on Screen Received.

alter table game_events add column if not exists screen_target_player_id uuid references players(id);
