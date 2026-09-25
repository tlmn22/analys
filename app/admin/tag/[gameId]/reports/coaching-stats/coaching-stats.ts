// Attributes outcomes (shots, rebounds, turnovers, fouls drawn/committed)
// to whichever named Set Offense/Transition/BLOB/SLOB (offense) or Man to
// Man/Zone/Press/Other Defense (defense) call was most recently made for a
// team — "current call until replaced" state, the same pattern used
// elsewhere in these reports for on-court lineups and offense/defense
// possession. There's no explicit link between a set-tag and the shot it
// produced, so this is an inferred attribution, not a stored fact.

import type { RawEvent } from "../game-summary/summary-stats";
import { computePossessions, type PossessionSegment } from "../game-summary/pace-stats";

const OFFENSE_SET_TYPES = new Set(["set_offense", "transition", "blob", "slob"]);
const DEFENSE_SET_TYPES = new Set(["man_to_man", "zone", "press", "other_defense"]);

// Transition/BLOB/SLOB are single-possession calls — unlike Set Offense,
// which is meant to describe the team's ongoing half-court scheme until
// replaced, a fast break or an inbound play only covers the one trip it
// produced. Without this, an untagged possession following one of these
// (the analyst not re-tagging every single half-court trip) would silently
// keep inheriting "Transition"/"BLOB"/"SLOB" until the next explicit call.
const SINGLE_POSSESSION_CATEGORIES = new Set(["transition", "blob", "slob"]);

export const OFFENSE_ROW_LABELS: Record<string, string> = {
  unassigned: "unassigned offense",
  set_offense: "Set Offense",
  transition: "Transition",
  blob: "BLOB",
  slob: "SLOB",
};

export const DEFENSE_ROW_LABELS: Record<string, string> = {
  unassigned: "unassigned defense",
  man_to_man: "Man to Man",
  zone: "Zone",
  press: "Press",
  other_defense: "Other Defense",
};

const FT_TYPES = new Set(["ft_made", "ft_miss"]);
// Events that count as "this set produced a recorded outcome" — a segment
// with none of these is a "no outcome" set (called, but nothing tagged
// before the next call/period end).
const OUTCOME_TYPES = new Set([
  "2pt_made",
  "2pt_miss",
  "3pt_made",
  "3pt_miss",
  "ft_made",
  "ft_miss",
  "off_reb",
  "turnover",
  "def_foul",
]);

/** Per-column event lists, kept separate so clicking one number's drill-down
 * only shows the clips that actually produced THAT number — not the whole
 * segment's unrelated events (screens, subs, hustle plays, ...). */
export interface CategoryEvents {
  setTag: RawEvent[]; // the actual set_offense/blob/... calls themselves
  scoring: RawEvent[]; // made shots (2pt/3pt/ft) — for Points/Points Per Set
  twoPt: RawEvent[]; // 2pt_made + 2pt_miss
  threePt: RawEvent[]; // 3pt_made + 3pt_miss
  oreb: RawEvent[];
  ft: RawEvent[]; // ft_made + ft_miss (raw attempts, not trip-grouped)
  to: RawEvent[];
  defFoul: RawEvent[];
  andOne: RawEvent[];
  /** The set-tag call for each segment that produced no recorded outcome —
   * for the "no outcome" column's drill-down. */
  noOutcome: RawEvent[];
}

export interface CategoryTotals {
  category: string;
  sets: number;
  points: number;
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  oreb: number;
  ftTrips: number;
  to: number;
  defFoul: number;
  andOne: number;
  noOutcomeSets: number;
  events: CategoryEvents;
}

function emptyEvents(): CategoryEvents {
  return {
    setTag: [],
    scoring: [],
    twoPt: [],
    threePt: [],
    oreb: [],
    ft: [],
    to: [],
    defFoul: [],
    andOne: [],
    noOutcome: [],
  };
}

function emptyTotals(category: string): CategoryTotals {
  return {
    category,
    sets: 0,
    points: 0,
    fgm2: 0,
    fga2: 0,
    fgm3: 0,
    fga3: 0,
    oreb: 0,
    ftTrips: 0,
    to: 0,
    defFoul: 0,
    andOne: 0,
    noOutcomeSets: 0,
    events: emptyEvents(),
  };
}

function countFtTrips(chronological: RawEvent[], teamId: string): number {
  let trips = 0;
  let streakTeam: string | null = null;
  for (const e of chronological) {
    if (FT_TYPES.has(e.eventType)) {
      if (streakTeam !== e.teamId && e.teamId === teamId) trips++;
      streakTeam = e.teamId;
    } else {
      streakTeam = null;
    }
  }
  return trips;
}

export interface Segment {
  category: string;
  start: number;
  end: number;
  tagEvent: RawEvent | null;
}

/** Splits the range into segments at every tag whose team/type matches
 * `setTypes` — "current call until replaced" state. `categoryKey` decides
 * what each segment after a given tag is labeled (defaults to the tag's own
 * event type; the defense-detail breakdown below keys on the tag's specific
 * subtype instead). */
export function buildCategorySegments(
  inRange: RawEvent[],
  teamId: string,
  setTypes: Set<string>,
  categoryKey: (e: RawEvent) => string,
  start: number,
  end: number
): Segment[] {
  const segments: Segment[] = [];
  let currentCategory = "unassigned";
  let segStart = start;
  let currentTagEvent: RawEvent | null = null;
  for (const e of inRange) {
    if (e.teamId === teamId && setTypes.has(e.eventType)) {
      segments.push({ category: currentCategory, start: segStart, end: e.t, tagEvent: currentTagEvent });
      currentCategory = categoryKey(e);
      segStart = e.t;
      currentTagEvent = e;
    }
  }
  segments.push({ category: currentCategory, start: segStart, end, tagEvent: currentTagEvent });
  return segments;
}

/** Walks each segment and attributes its outcomes (shots, rebounds,
 * turnovers, fouls) to whatever category that segment carries — the shared
 * accumulation core behind both the top-level Offensive/Defensive Sets
 * table and the Defense detail breakdown. Categories are created in the map
 * on demand (not pre-seeded), so callers that need every known row present
 * even at zero sets should seed the map before merging these in. */
export function accumulateSegmentTotals(
  segments: Segment[],
  inRange: RawEvent[],
  shootingTeam: string,
  foulTeam: string
): Map<string, CategoryTotals> {
  const totalsByCategory = new Map<string, CategoryTotals>();

  for (const seg of segments) {
    const segEvents = inRange.filter((e) => e.t >= seg.start && e.t < seg.end);
    const shots = segEvents.filter((e) => e.teamId === shootingTeam);
    const fouls = segEvents.filter((e) => e.teamId === foulTeam && e.eventType === "def_foul");
    const hasOutcome = segEvents.some(
      (e) => OUTCOME_TYPES.has(e.eventType) && (e.teamId === shootingTeam || e.teamId === foulTeam)
    );

    const twoPt = shots.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss");
    const threePt = shots.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss");
    const ft = shots.filter((e) => FT_TYPES.has(e.eventType));
    const orebEvents = shots.filter((e) => e.eventType === "off_reb");
    const toEvents = shots.filter((e) => e.eventType === "turnover");
    const scoring = shots.filter((e) => e.eventType.endsWith("_made") && (e.points ?? 0) > 0);
    const andOneEvents = scoring.filter((e) => e.andOne);

    const totals = totalsByCategory.get(seg.category) ?? emptyTotals(seg.category);
    totals.sets += 1;
    totals.points += scoring.reduce((s, e) => s + (e.points ?? 0), 0);
    totals.fgm2 += twoPt.filter((e) => e.eventType === "2pt_made").length;
    totals.fga2 += twoPt.length;
    totals.fgm3 += threePt.filter((e) => e.eventType === "3pt_made").length;
    totals.fga3 += threePt.length;
    totals.oreb += orebEvents.length;
    totals.to += toEvents.length;
    totals.andOne += andOneEvents.length;
    totals.ftTrips += countFtTrips(segEvents, shootingTeam);
    totals.defFoul += fouls.length;
    if (!hasOutcome) {
      totals.noOutcomeSets += 1;
      if (seg.tagEvent) totals.events.noOutcome.push(seg.tagEvent);
    }

    if (seg.tagEvent) totals.events.setTag.push(seg.tagEvent);
    totals.events.scoring.push(...scoring);
    totals.events.twoPt.push(...twoPt);
    totals.events.threePt.push(...threePt);
    totals.events.oreb.push(...orebEvents);
    totals.events.ft.push(...ft);
    totals.events.to.push(...toEvents);
    totals.events.defFoul.push(...fouls);
    totals.events.andOne.push(...andOneEvents);

    totalsByCategory.set(seg.category, totals);
  }

  return totalsByCategory;
}

/** Clips every segment matching `isSinglePossession` to the possession it
 * was tagged during — anything left over (no further tag before that
 * possession ends) reverts to "unassigned" instead of staying credited to
 * the call. Shared by the top-level Offensive Sets table (transition/blob/
 * slob) and Scouting Report's per-play-name breakdown (each named Set
 * Offense call). */
export function clipToSinglePossession(
  segments: Segment[],
  isSinglePossession: (category: string) => boolean,
  possessions: PossessionSegment[]
): Segment[] {
  const clipped: Segment[] = [];
  for (const seg of segments) {
    if (isSinglePossession(seg.category)) {
      const poss = possessions.find((p) => p.start <= seg.start && seg.start < p.end);
      if (poss && poss.end < seg.end) {
        clipped.push({ ...seg, end: poss.end });
        clipped.push({ category: "unassigned", start: poss.end, end: seg.end, tagEvent: null });
        continue;
      }
    }
    clipped.push(seg);
  }
  return clipped;
}

/**
 * Computes the per-set-category rows for one team's Offensive or Defensive
 * Sets table. `mode: "offense"` scopes to set_offense/transition/blob/slob
 * calls where this team was attacking; `"defense"` scopes to man_to_man/
 * zone/press/other_defense calls where this team was defending — in both
 * cases the "shooting team" whose makes/misses count toward the row is
 * resolved automatically (this team on offense, the opponent on defense),
 * and "Def Foul" always means fouls committed by whichever team is
 * currently defending in that segment.
 */
export function computeSetCategoryTotals(
  allEvents: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  mode: "offense" | "defense",
  start: number,
  end: number
): CategoryTotals[] {
  const setTypes = mode === "offense" ? OFFENSE_SET_TYPES : DEFENSE_SET_TYPES;
  const rowLabels = mode === "offense" ? OFFENSE_ROW_LABELS : DEFENSE_ROW_LABELS;
  const shootingTeam = mode === "offense" ? teamId : opponentTeamId;
  const foulTeam = mode === "offense" ? opponentTeamId : teamId;

  const inRange = allEvents.filter((e) => e.t >= start && e.t <= end).sort((a, b) => a.t - b.t);

  const segments = buildCategorySegments(inRange, teamId, setTypes, (e) => e.eventType, start, end);

  // Transition/BLOB/SLOB are single-possession calls — clip each one to the
  // possession it was tagged during (see clipToSinglePossession above).
  const clippedSegments =
    mode === "offense"
      ? clipToSinglePossession(
          segments,
          (cat) => SINGLE_POSSESSION_CATEGORIES.has(cat),
          computePossessions(allEvents, teamId, opponentTeamId).filter((p) => p.teamId === teamId)
        )
      : segments;

  const totalsByCategory = new Map<string, CategoryTotals>();
  for (const key of Object.keys(rowLabels)) totalsByCategory.set(key, emptyTotals(key));
  for (const [key, totals] of accumulateSegmentTotals(clippedSegments, inRange, shootingTeam, foulTeam)) {
    totalsByCategory.set(key, totals);
  }

  return Object.keys(rowLabels).map((key) => totalsByCategory.get(key)!);
}

export interface PlayNameRow {
  key: string;
  label: string;
  totals: CategoryTotals;
}

const PLAY_PREFIX = "play:";

/**
 * Breaks "Set Offense" down by the specific named play called (e.g.
 * "Motion", "Zipper" — the per-game growable list from play-name-panel.tsx),
 * each one clipped to the single possession it was called for (same
 * treatment as Transition/BLOB/SLOB — a named play call describes one trip,
 * not an ongoing scheme). Used by the Scouting Report's "which of our sets
 * actually scores" breakdown; Transition and no-call ("unassigned") stay
 * available from computeSetCategoryTotals's own offense rows. Most-called
 * play first.
 */
export function computeSetOffensePlayRows(
  allEvents: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  start: number,
  end: number
): PlayNameRow[] {
  const inRange = allEvents.filter((e) => e.t >= start && e.t <= end).sort((a, b) => a.t - b.t);

  const categoryKey = (e: RawEvent): string =>
    e.eventType === "set_offense" ? `${PLAY_PREFIX}${e.setOffenseName || "Unnamed"}` : e.eventType;

  const segments = buildCategorySegments(inRange, teamId, OFFENSE_SET_TYPES, categoryKey, start, end);
  const possessions = computePossessions(allEvents, teamId, opponentTeamId).filter((p) => p.teamId === teamId);
  const clipped = clipToSinglePossession(segments, (cat) => cat.startsWith(PLAY_PREFIX), possessions);

  const totalsByKey = accumulateSegmentTotals(clipped, inRange, teamId, opponentTeamId);

  const rows: PlayNameRow[] = [];
  for (const [key, totals] of totalsByKey) {
    if (!key.startsWith(PLAY_PREFIX)) continue;
    rows.push({ key, label: key.slice(PLAY_PREFIX.length), totals });
  }

  return rows.sort((a, b) => b.totals.sets - a.totals.sets);
}

const DEFENSE_DETAIL_TYPE_FIELD: Partial<Record<string, keyof RawEvent>> = {
  man_to_man: "manToManType",
  zone: "zoneType",
  press: "pressType",
};

export interface DefenseDetailRow {
  key: string;
  label: string;
  totals: CategoryTotals;
}

/**
 * Breaks the Defensive Sets categories down one level further — e.g. "Man
 * to Man" split into Full-court man / Half-court man / ..., "Zone" into
 * 2-3 / 3-2 / ..., "Press" into 1-2-2 / 2-2-1 / ... — using each call's own
 * subtype field (man_to_man_type/zone_type/press_type) rather than just the
 * top-level event type. "Other Defense" has no subtype to split on and
 * "unassigned" (no call tagged) isn't a defense that was actually run, so
 * both are left out — this is purely "what specific defenses were called."
 * Rows are grouped by top-level category (in DEFENSE_ROW_LABELS order),
 * most-called subtype first within each group.
 */
export function computeDefenseSetDetailRows(
  allEvents: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  start: number,
  end: number
): DefenseDetailRow[] {
  const inRange = allEvents.filter((e) => e.t >= start && e.t <= end).sort((a, b) => a.t - b.t);

  const categoryKey = (e: RawEvent): string => {
    const field = DEFENSE_DETAIL_TYPE_FIELD[e.eventType];
    if (!field) return e.eventType; // other_defense — no subtype dimension
    const sub = (e[field] as string | null | undefined) || "Other";
    return `${e.eventType}::${sub}`;
  };

  const segments = buildCategorySegments(inRange, teamId, DEFENSE_SET_TYPES, categoryKey, start, end);
  const totalsByKey = accumulateSegmentTotals(segments, inRange, opponentTeamId, teamId);

  const groupOrder = Object.keys(DEFENSE_ROW_LABELS);
  const rows: DefenseDetailRow[] = [];
  for (const [key, totals] of totalsByKey) {
    if (key === "unassigned" || key === "other_defense") continue;
    const [category, sub] = key.split("::");
    rows.push({ key, label: `${DEFENSE_ROW_LABELS[category] ?? category} — ${sub}`, totals });
  }

  rows.sort((a, b) => {
    const [aCat] = a.key.split("::");
    const [bCat] = b.key.split("::");
    const groupDiff = groupOrder.indexOf(aCat) - groupOrder.indexOf(bCat);
    if (groupDiff !== 0) return groupDiff;
    return b.totals.sets - a.totals.sets;
  });

  return rows;
}

function mergeEvents(rows: CategoryEvents[]): CategoryEvents {
  return {
    setTag: rows.flatMap((r) => r.setTag),
    scoring: rows.flatMap((r) => r.scoring),
    twoPt: rows.flatMap((r) => r.twoPt),
    threePt: rows.flatMap((r) => r.threePt),
    oreb: rows.flatMap((r) => r.oreb),
    ft: rows.flatMap((r) => r.ft),
    to: rows.flatMap((r) => r.to),
    defFoul: rows.flatMap((r) => r.defFoul),
    andOne: rows.flatMap((r) => r.andOne),
    noOutcome: rows.flatMap((r) => r.noOutcome),
  };
}

export function sumTotals(rows: CategoryTotals[]): CategoryTotals {
  const base = rows.reduce(
    (acc, r) => ({
      category: "TOTAL",
      sets: acc.sets + r.sets,
      points: acc.points + r.points,
      fgm2: acc.fgm2 + r.fgm2,
      fga2: acc.fga2 + r.fga2,
      fgm3: acc.fgm3 + r.fgm3,
      fga3: acc.fga3 + r.fga3,
      oreb: acc.oreb + r.oreb,
      ftTrips: acc.ftTrips + r.ftTrips,
      to: acc.to + r.to,
      defFoul: acc.defFoul + r.defFoul,
      andOne: acc.andOne + r.andOne,
      noOutcomeSets: acc.noOutcomeSets + r.noOutcomeSets,
      events: emptyEvents(),
    }),
    emptyTotals("TOTAL")
  );
  base.events = mergeEvents(rows.map((r) => r.events));
  return base;
}
