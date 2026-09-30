-- Apply before deploying Good Defense / Bad Defense tagging.
alter table public.game_events
  add column if not exists defense_type text;

alter table public.game_events
  add constraint game_events_defense_type_check check (
    (event_type = 'good_defense' and defense_type is not null
      and defense_type in ('Save Mid', 'Good Help') and player_id is not null and team_id is not null)
    or (event_type = 'bad_defense' and defense_type is not null
      and defense_type in ('Lost Mid', 'Bad Help') and player_id is not null and team_id is not null)
    or (event_type not in ('good_defense', 'bad_defense') and defense_type is null)
  );

notify pgrst, 'reload schema';
