-- Physical Contact detail: two players involved in a physical battle
-- (post seal, box out, screen contact, ...), the specific type, and who
-- won it — inspired by Roland Beech's research on physical-battle impact
-- on game outcomes. `player_id` holds the first player; the columns below
-- hold the second player and the winner (one of the two).

alter table game_events add column if not exists physical_contact_type text;
alter table game_events add column if not exists physical_contact_second_player_id uuid references players(id);
alter table game_events add column if not exists physical_contact_winner_player_id uuid references players(id);
