create table public.event_package_assignments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.event_packages(id) on delete cascade,
  member_id uuid not null references public.club_staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(package_id, member_id)
);
create index event_package_assignments_member_idx on public.event_package_assignments(member_id);
alter table public.event_package_assignments enable row level security;
revoke all on public.event_package_assignments from anon, authenticated;
grant all on public.event_package_assignments to service_role;
notify pgrst, 'reload schema';
