-- Requires 029_event_packages.sql. Create the package and its clips atomically.
create function public.create_event_package_with_events(package_name text, package_description text, selected_event_ids uuid[])
returns uuid language plpgsql security invoker set search_path = public as $$
declare new_id uuid;
begin
  if coalesce(cardinality(selected_event_ids), 0) < 1 or cardinality(selected_event_ids) > 1000 then
    raise exception 'Select between 1 and 1000 events';
  end if;
  insert into event_packages(name, description)
    values (btrim(package_name), coalesce(package_description, '')) returning id into new_id;
  insert into event_package_items(package_id, event_id)
    select new_id, event_id from unnest(selected_event_ids) as selected(event_id)
    on conflict (package_id, event_id) do nothing;
  return new_id;
end;
$$;
revoke all on function public.create_event_package_with_events(text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.create_event_package_with_events(text, text, uuid[]) to service_role;
notify pgrst, 'reload schema';
