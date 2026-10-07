// Classifies each of a team's possessions by how the trip was run, from the
// tags made during it: Transition, BLOB/SLOB (designed inbound plays), Set
// Offense, or Unstructured (none of those) — then totals each type's share
// and efficiency. Unlike the call-based Offensive Sets table, every
// possession counts exactly once.

import type { RawEvent } from "./game-summary/summary-stats";
import { computePossessions, type PossessionSegment } from "./game-summary/pace-stats";

export type PossessionType = "transition" | "inbound" | "set" | "unstructured" | "unmatched";
// First match wins: a fast break off a set call is still transition.
export const POSSESSION_TYPES: PossessionType[] = ["transition", "inbound", "set", "unstructured"];
// Shots/FTs/turnovers that fall outside every one of the team's possessions
// — usually a missing Def Reb tag. Shown separately (0 possessions) so the
// points still add up to the score.

export interface PossessionTypeRow {
  type: PossessionType;
  possessions: number;
  points: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  turnovers: number;
  /** Shots, turnovers and FTs of these trips — for clip drill-downs. */
  events: RawEvent[];
}

const FG2 = ["2pt_made", "2pt_miss"];
const FG3 = ["3pt_made", "3pt_miss"];
const CLIP_TYPES = new Set([...FG2, ...FG3, "ft_made", "ft_miss", "turnover"]);

export function classifyPossession(tags: RawEvent[]): Exclude<PossessionType, "unmatched"> {
  const types = new Set(tags.map((e) => e.eventType));
  if (types.has("transition")) return "transition";
  if (types.has("blob") || types.has("slob")) return "inbound";
  if (types.has("set_offense")) return "set";
  return "unstructured";
}

export function computePossessionTypes(
  events: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  possessions: PossessionSegment[] = computePossessions(events, teamId, opponentTeamId)
): { rows: PossessionTypeRow[]; unmatched: PossessionTypeRow } {
  const empty = (type: PossessionType): PossessionTypeRow => ({ type, possessions: 0, points: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, turnovers: 0, events: [] });
  const rows = new Map<PossessionType, PossessionTypeRow>(POSSESSION_TYPES.map((type) => [type, empty(type)]));
  const unmatched = empty("unmatched");
  const covered = new Set<RawEvent>();
  const sorted = [...events].sort((a, b) => a.t - b.t);
  for (const p of possessions) {
    if (p.teamId !== teamId) continue;
    // Closed window: the basket that ends the trip (and FTs at the same
    // stopped clock) sit at p.end; the previous trip's closer at p.start
    // belongs to the other team, so filtering by teamId keeps it out.
    const mine = sorted.filter((e) => e.teamId === teamId && e.period === p.period && e.t >= p.start && e.t <= p.end);
    const row = rows.get(classifyPossession(mine))!;
    row.possessions++;
    for (const e of mine) {
      if (covered.has(e)) continue;
      covered.add(e);
      addOutcome(row, e);
    }
  }
  for (const e of sorted) {
    if (e.teamId === teamId && !covered.has(e) && ((e.points ?? 0) > 0 || CLIP_TYPES.has(e.eventType))) addOutcome(unmatched, e);
  }
  return { rows: POSSESSION_TYPES.map((type) => rows.get(type)!), unmatched };
}

function addOutcome(row: PossessionTypeRow, e: RawEvent) {
  row.points += e.points ?? 0;
  if (FG2.includes(e.eventType) || FG3.includes(e.eventType)) {
    row.fga++;
    if (e.eventType.endsWith("_made")) row.fgm++;
  }
  if (FG3.includes(e.eventType)) {
    row.fg3a++;
    if (e.eventType === "3pt_made") row.fg3m++;
  }
  if (e.eventType === "turnover") row.turnovers++;
  if (CLIP_TYPES.has(e.eventType)) row.events.push(e);
}
