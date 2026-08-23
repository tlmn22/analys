-- Supports editing an already-tagged event: "key_event" flags a
-- game-turning moment for later report use (per the analyst's own
-- definition, not derived from anything else).

alter table game_events add column if not exists key_event boolean not null default false;
