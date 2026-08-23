// Attributes outcomes (shots, rebounds, turnovers, fouls drawn/committed)
// to whichever named Set Offense/Transition/BLOB/SLOB (offense) or Man to
// Man/Zone/Press/Other Defense (defense) call was most recently made for a
// team — "current call until replaced" state, the same pattern used
// elsewhere in these reports for on-court lineups and offense/defense
// possession. There's no explicit link between a set-tag and the shot it
// produced, so this is an inferred attribution, not a stored fact.

import type { RawEvent } from "../game-summary/summary-stats";

const OFFENSE_SET_TYPES = new Set(["set_offense", "transition", "blob", "slob"]);
const DEFENSE_SET_TYPES = new Set(["man_to_man", "zone", "press", "other_defense"]);

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

  const segments: { category: string; start: number; end: number; tagEvent: RawEvent | null }[] = [];
  let currentCategory = "unassigned";
  let segStart = start;
  let currentTagEvent: RawEvent | null = null;
  for (const e of inRange) {
    if (e.teamId === teamId && setTypes.has(e.eventType)) {
      segments.push({ category: currentCategory, start: segStart, end: e.t, tagEvent: currentTagEvent });
      currentCategory = e.eventType;
      segStart = e.t;
      currentTagEvent = e;
    }
  }
  segments.push({ category: currentCategory, start: segStart, end, tagEvent: currentTagEvent });

  const totalsByCategory = new Map<string, CategoryTotals>();
  for (const key of Object.keys(rowLabels)) totalsByCategory.set(key, emptyTotals(key));

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

  return Object.keys(rowLabels).map((key) => totalsByCategory.get(key)!);
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
