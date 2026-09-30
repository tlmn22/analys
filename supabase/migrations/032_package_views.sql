create table public.event_package_views (
  run_id uuid primary key,
  assignment_id uuid not null references public.event_package_assignments(id) on delete cascade,
  item_id uuid not null references public.event_package_items(id) on delete cascade,
  watched_seconds double precision not null check (watched_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
create index event_package_views_assignment_idx on public.event_package_views(assignment_id, item_id);
alter table public.event_package_views enable row level security;
revoke all on public.event_package_views from anon, authenticated;
grant all on public.event_package_views to service_role;

create function public.record_package_view(p_member uuid, p_item uuid, p_run uuid, p_watched double precision, p_duration double precision)
returns boolean language plpgsql security invoker set search_path = public as $$
declare assignment uuid; expected_duration double precision; done boolean;
begin
  select a.id, e.video_time + i.trail_seconds - greatest(0, e.video_time - i.lead_seconds)
    into assignment, expected_duration
    from event_package_items i join game_events e on e.id=i.event_id
    join event_package_assignments a on a.package_id=i.package_id
    where i.id=p_item and a.member_id=p_member for share of a, i;
  if assignment is null then raise exception 'Package is not assigned'; end if;
  if not (p_duration > 0 and p_duration <= expected_duration + 0.01 and p_watched >= 0 and p_watched <= p_duration + 0.01) then
    raise exception 'Invalid playback duration';
  end if;
  done := p_watched >= p_duration * 0.8;
  insert into event_package_views(run_id,assignment_id,item_id,watched_seconds,completed)
    values(p_run,assignment,p_item,p_watched,done)
    on conflict(run_id) do update set
      watched_seconds=greatest(event_package_views.watched_seconds,excluded.watched_seconds),
      completed=event_package_views.completed or excluded.completed,
      updated_at=now()
    where event_package_views.assignment_id=assignment and event_package_views.item_id=p_item;
  if not found then raise exception 'Playback session mismatch'; end if;
  return done;
end;
$$;
revoke all on function public.record_package_view(uuid,uuid,uuid,double precision,double precision) from public,anon,authenticated;
grant execute on function public.record_package_view(uuid,uuid,uuid,double precision,double precision) to service_role;
notify pgrst, 'reload schema';
