-- A club's people (owner/manager/head coach/assistant coach/player) —
-- Non-player members can log in to edit their own club's event attendance
-- and descriptions. Player accounts are attendance subjects, not editors.
-- password_hash is a salted scrypt hash (see lib/password.ts), never a
-- plaintext password. The "player" role here is a lightweight, unverified
-- account distinct from the `players` table used for game tagging/rosters
-- — no link between the two.

do $$ begin
  create type club_staff_role as enum ('owner', 'manager', 'head_coach', 'assistant_coach', 'player');
exception
  when duplicate_object then null;
end $$;

-- Covers the case where this migration was already run before the
-- "player" role was added — ADD VALUE IF NOT EXISTS is a no-op otherwise.
alter type club_staff_role add value if not exists 'player';

create table if not exists club_staff (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  password_hash text not null,
  role club_staff_role not null,
  created_at timestamptz not null default now()
);
