-- Standalone club registry (organization/sponsor info) — separate from the
-- existing team registry, no foreign key link between them for now.

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  sponsor_name text,
  sponsor_logo_url text,
  created_at timestamptz not null default now()
);
