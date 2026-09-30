-- Apply before deploying the Help Defense tagging feature.
alter table public.game_events
  add column if not exists help_defense_type text
  check (help_defense_type in ('Good', 'Normal', 'Bad'));
