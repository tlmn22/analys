-- Generalize the per-game play-name list (previously "offense sets" only)
-- to also cover BLOB/SLOB inbound plays — baseline vs sideline inbounds
-- typically call different named sets, so each gets its own per-game list
-- via the new `category` column. Existing rows default to 'set_offense'.

alter table game_offense_sets add column if not exists category text not null default 'set_offense';

-- Swap the (game_id, name) unique constraint for (game_id, category, name)
-- so the same name can exist once per category. Looked up dynamically
-- since the auto-generated constraint name isn't guaranteed.
do $$
declare
  old_constraint text;
begin
  select conname into old_constraint
  from pg_constraint
  where conrelid = 'game_offense_sets'::regclass
    and contype = 'u'
    and conname != 'game_offense_sets_game_id_category_name_key';

  if old_constraint is not null then
    execute format('alter table game_offense_sets drop constraint %I', old_constraint);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'game_offense_sets_game_id_category_name_key'
  ) then
    alter table game_offense_sets
      add constraint game_offense_sets_game_id_category_name_key unique (game_id, category, name);
  end if;
end $$;

-- BLOB/SLOB detail: which named play was called, and its outcome
-- (Score/No Score/Turnover/Continue Offense) — lets reports show
-- success rate per named inbound play.
alter table game_events add column if not exists blob_play_name text;
alter table game_events add column if not exists blob_outcome text;
alter table game_events add column if not exists slob_play_name text;
alter table game_events add column if not exists slob_outcome text;
