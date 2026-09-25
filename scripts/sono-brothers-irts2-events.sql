-- Reviewed irts2.xlsx schedule: 18 dates, 33 gym training events.
-- Does not import attendance or the excluded dates/ranges.
-- All schedule times below are Asia/Ulaanbaatar local time.
BEGIN;

-- Serialize this import with other event writes so repeat runs cannot race.
LOCK TABLE public.club_events IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  target_club_id uuid;
  matching_clubs integer;
  inserted_count integer;
BEGIN
  SELECT count(*) INTO matching_clubs
  FROM public.clubs
  WHERE lower(btrim(name)) = 'sono brothers';

  IF matching_clubs <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Sono Brothers club; found %.', matching_clubs;
  END IF;

  SELECT id INTO target_club_id
  FROM public.clubs
  WHERE lower(btrim(name)) = 'sono brothers';

  WITH schedule(day, morning, evening) AS (
    VALUES
      (DATE '2026-08-24', true,  true),
      (DATE '2026-08-25', true,  true),
      (DATE '2026-08-26', true,  true),
      (DATE '2026-08-27', true,  true),
      (DATE '2026-08-28', true,  true),
      (DATE '2026-08-31', true,  true),
      (DATE '2026-09-07', true,  true),
      (DATE '2026-09-08', true,  true),
      (DATE '2026-09-09', true,  true),
      (DATE '2026-09-10', true,  true),
      (DATE '2026-09-11', true,  true),
      (DATE '2026-09-14', true,  true),
      (DATE '2026-09-16', false, true),
      (DATE '2026-09-17', true,  true),
      (DATE '2026-09-18', true,  true),
      (DATE '2026-09-21', true,  true),
      (DATE '2026-09-22', true,  false),
      (DATE '2026-09-23', true,  false)
  ), sessions AS (
    SELECT s.day, slot.is_morning,
      CASE WHEN slot.is_morning THEN TIME '07:00'
           WHEN extract(isodow FROM s.day) = 4 THEN TIME '16:00'
           WHEN extract(isodow FROM s.day) = 5 THEN TIME '19:00'
           ELSE TIME '18:00' END AS start_time,
      CASE WHEN slot.is_morning AND extract(isodow FROM s.day) IN (3, 5)
           THEN 'Naadam' ELSE 'Gan' END AS location
    FROM schedule s
    CROSS JOIN LATERAL (
      VALUES (true, s.morning), (false, s.evening)
    ) AS slot(is_morning, included)
    WHERE slot.included
  ), prepared AS (
    SELECT
      CASE WHEN is_morning THEN 'Өглөөний бэлтгэл' ELSE 'Оройн бэлтгэл' END AS name,
      location,
      (day + start_time) AT TIME ZONE 'Asia/Ulaanbaatar' AS start_at,
      (day + start_time + INTERVAL '2 hours') AT TIME ZONE 'Asia/Ulaanbaatar' AS end_at
    FROM sessions
  )
  INSERT INTO public.club_events
    (club_id, name, event_type, location, start_at, end_at, description)
  SELECT target_club_id, p.name, 'gym_prep', p.location, p.start_at, p.end_at,
    'irts2.xlsx · Баталсан долоо хоногийн хуваарийн дагуу.'
  FROM prepared p
  WHERE NOT EXISTS (
    -- Preserve any existing gym session for this club at the same start time.
    SELECT 1 FROM public.club_events existing
    WHERE existing.club_id = target_club_id
      AND existing.event_type = 'gym_prep'
      AND existing.start_at = p.start_at
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Created % events; skipped % existing events.', inserted_count, 33 - inserted_count;
END $$;

COMMIT;
