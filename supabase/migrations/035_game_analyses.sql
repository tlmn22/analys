-- Expert write-up per game (Markdown subset: ## headings, - bullets, **bold**).
-- Written by scripts/save-game-analysis.mjs; read by the game's report pages.
create table public.game_analyses (
  game_id uuid primary key references public.games(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  updated_at timestamptz not null default now()
);
alter table public.game_analyses enable row level security;
revoke all on public.game_analyses from anon, authenticated;
grant all on public.game_analyses to service_role;
notify pgrst, 'reload schema';
