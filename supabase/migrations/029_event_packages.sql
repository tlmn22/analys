-- Admin-only scouting collections. Sharing is intentionally not enabled.
create table public.event_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  created_at timestamptz not null default now()
);
create table public.event_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.event_packages(id) on delete cascade,
  event_id uuid not null references public.game_events(id) on delete cascade,
  lead_seconds integer not null default 7 check (lead_seconds >= 0),
  trail_seconds integer not null default 7 check (trail_seconds >= 0),
  created_at timestamptz not null default now(),
  unique (package_id, event_id)
);
alter table public.event_packages enable row level security;
alter table public.event_package_items enable row level security;
revoke all on public.event_packages, public.event_package_items from anon, authenticated;
grant all on public.event_packages, public.event_package_items to service_role;

-- Creating a collection and adding its first event succeed or fail together.
create function public.create_event_package_with_event(package_name text, package_description text, selected_event_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare new_id uuid;
begin
  insert into event_packages(name, description) values (btrim(package_name), coalesce(package_description, '')) returning id into new_id;
  insert into event_package_items(package_id, event_id) values (new_id, selected_event_id);
  return new_id;
end;
$$;
revoke all on function public.create_event_package_with_event(text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_event_package_with_event(text, text, uuid) to service_role;
notify pgrst, 'reload schema';
