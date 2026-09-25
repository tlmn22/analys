-- Boxout detail: call quality (Good/Bad), picked before the player since
-- the quality is judged independent of who executed it. Either team's
-- on-court players can be picked (bothTeams), matching Hustle Play/
-- Physical Contact.

alter table game_events add column if not exists boxout_type text;
