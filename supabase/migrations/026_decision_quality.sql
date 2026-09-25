-- One optional decision assessment per event; historical rows stay ungraded.
alter table public.game_events
  add column if not exists decision_quality text
  check (decision_quality in ('good', 'bad'));

notify pgrst, 'reload schema';
