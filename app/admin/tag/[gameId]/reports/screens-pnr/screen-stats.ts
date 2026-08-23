// Everything screen/PnR related: who sets screens and what happens to them
// (screen_set/screen_rcvd, which also store the screener+ball-handler pair
// directly — no inference needed for "who screens for whom"), which named
// actions (PnR, Pick and Pop, ...) the offense ran and how they turned
// out, and which on-ball/off-ball coverages the defense called against
// them and how those held up. Outcome attribution (points/FG/TO) reuses
// the same "reconstructed possession" building block as Game Summary's
// Pace report (pace-stats.ts) — whichever possession a tag falls inside
// donates its final result to that tag's category.

import type { RawEvent } from "../game-summary/summary-stats";
import type { PossessionSegment } from "../game-summary/pace-stats";

export interface CountRow {
  playerId: string;
  byType: Map<string, RawEvent[]>;
  other: RawEvent[];
  total: RawEvent[];
}

function computeCountRows(
  events: RawEvent[],
  teamId: string,
  playerIds: string[],
  eventType: string,
  typeField: (e: RawEvent) => string | null,
  knownTypes: string[]
): CountRow[] {
  const known = new Set(knownTypes);
  const mine = events.filter((e) => e.teamId === teamId && e.eventType === eventType && e.playerId);

  return playerIds
    .map((playerId) => {
      const playerEvents = mine.filter((e) => e.playerId === playerId);
      const byType = new Map<string, RawEvent[]>();
      const other: RawEvent[] = [];
      for (const e of playerEvents) {
        const v = typeField(e);
        if (v && known.has(v)) {
          const arr = byType.get(v) ?? [];
          arr.push(e);
          byType.set(v, arr);
        } else {
          other.push(e);
        }
      }
      return { playerId, byType, other, total: playerEvents };
    })
    .filter((row) => row.total.length > 0);
}

/** Screen Setters — one row per screener, columns = the outcome tagged on
 * the screen itself (Pop/Roll/Stay/DHO/Handoff/Rescreen). */
export function computeScreenSetterRows(events: RawEvent[], teamId: string, playerIds: string[]): CountRow[] {
  return computeCountRows(events, teamId, playerIds, "screen_set", (e) => e.screenSetType ?? null, [
    "DHO",
    "Handoff",
    "Pop",
    "Rescreen",
    "Roll",
    "Stay",
  ]);
}

/** Screen Usage — one row per ball-handler, columns = what they did with
 * the screen (Reject/Use). */
export function computeScreenUsageRows(events: RawEvent[], teamId: string, playerIds: string[]): CountRow[] {
  return computeCountRows(events, teamId, playerIds, "screen_rcvd", (e) => e.screenRcvdType ?? null, [
    "Reject",
    "Use",
  ]);
}

export interface ScreenCombo {
  screenerId: string;
  ballHandlerId: string;
  events: RawEvent[];
  reject: RawEvent[];
  use: RawEvent[];
}

/** screen_rcvd already stores both participants on the same row (the ball
 * handler as playerId, the screener as screenerPlayerId) — so the
 * screener+ball-handler pair is a direct read, not an inference. Sorted by
 * total screens together, most first. */
export function computeScreenCombos(events: RawEvent[], teamId: string): ScreenCombo[] {
  const mine = events.filter(
    (e) => e.teamId === teamId && e.eventType === "screen_rcvd" && e.playerId && e.screenerPlayerId
  );

  const byPair = new Map<string, ScreenCombo>();
  for (const e of mine) {
    const key = `${e.screenerPlayerId}:${e.playerId}`;
    const combo = byPair.get(key) ?? {
      screenerId: e.screenerPlayerId!,
      ballHandlerId: e.playerId!,
      events: [],
      reject: [],
      use: [],
    };
    combo.events.push(e);
    if (e.screenRcvdType === "Reject") combo.reject.push(e);
    else if (e.screenRcvdType === "Use") combo.use.push(e);
    byPair.set(key, combo);
  }

  return [...byPair.values()].sort((a, b) => b.events.length - a.events.length);
}

export interface ActionCategoryTotals {
  category: string;
  count: number; // distinct possessions this category was tagged in
  points: number;
  fgm: number;
  fga: number;
  to: number;
  tagEvents: RawEvent[];
  outcomeEvents: RawEvent[];
}

function emptyActionTotals(category: string): ActionCategoryTotals {
  return { category, count: 0, points: 0, fgm: 0, fga: 0, to: 0, tagEvents: [], outcomeEvents: [] };
}

const FG_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);

/**
 * Attributes each possession's result (points, FG, turnovers) to every
 * distinct action/coverage category tagged during that possession —
 * `mode: "offense"` scans the tagging team's own possessions (e.g. off_action
 * = PnR/Pick and Pop/...), `mode: "defense"` scans the OPPONENT's
 * possessions instead (e.g. def_coverage tagged by the defense, scored
 * against them) so the numbers read as "points allowed while in this
 * coverage." A possession with two different tags (e.g. PnR then, on the
 * same possession, a Pick and Pop) credits both — they're not mutually
 * exclusive the way Set Offense/Transition/BLOB/SLOB are in Coaching Stats.
 */
export function computeActionRows(
  events: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  mode: "offense" | "defense",
  tagEventType: string,
  getValue: (e: RawEvent) => string | null,
  possessions: PossessionSegment[],
  start: number,
  end: number
): Map<string, ActionCategoryTotals> {
  const possTeamId = mode === "offense" ? teamId : opponentTeamId;
  const inRangePoss = possessions.filter((p) => p.teamId === possTeamId && p.start >= start && p.start < end);

  const totals = new Map<string, ActionCategoryTotals>();

  for (const poss of inRangePoss) {
    const possEvents = events.filter((e) => e.t >= poss.start && e.t < poss.end);
    const tags = possEvents.filter((e) => e.teamId === teamId && e.eventType === tagEventType && getValue(e));
    if (tags.length === 0) continue;

    const outcomeEvents = possEvents.filter((e) => e.teamId === possTeamId);
    const points = outcomeEvents.reduce((s, e) => s + (e.points ?? 0), 0);
    const fgEvents = outcomeEvents.filter((e) => FG_TYPES.has(e.eventType));
    const fgm = fgEvents.filter((e) => e.eventType.endsWith("_made")).length;
    const fga = fgEvents.length;
    const to = outcomeEvents.filter((e) => e.eventType === "turnover").length;

    const seenCategories = new Set<string>();
    for (const tag of tags) {
      const category = getValue(tag)!;
      if (seenCategories.has(category)) continue;
      seenCategories.add(category);
      const t = totals.get(category) ?? emptyActionTotals(category);
      t.count += 1;
      t.points += points;
      t.fgm += fgm;
      t.fga += fga;
      t.to += to;
      t.tagEvents.push(tag);
      t.outcomeEvents.push(...outcomeEvents);
      totals.set(category, t);
    }
  }

  return totals;
}
