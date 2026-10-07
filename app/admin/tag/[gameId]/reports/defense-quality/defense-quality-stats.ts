// Individual defensive quality per player: Good/Bad Defense calls (by type),
// Help Defense grades and Box out quality — every tag that judges a single
// defender, so weak links stand out.

import type { RawEvent } from "../game-summary/summary-stats";

export const GOOD_TYPES = ["Save Mid", "Good Help"] as const;
export const BAD_TYPES = ["Lost Mid", "Bad Help"] as const;
export const HELP_GRADES = ["Good", "Normal", "Bad"] as const;

export interface DefenseQualityRow {
  playerId: string;
  good: Record<(typeof GOOD_TYPES)[number], RawEvent[]>;
  bad: Record<(typeof BAD_TYPES)[number], RawEvent[]>;
  help: Record<(typeof HELP_GRADES)[number], RawEvent[]>;
  boxoutGood: RawEvent[];
  boxoutBad: RawEvent[];
}

export function emptyDefenseRow(playerId: string): DefenseQualityRow {
  return {
    playerId,
    good: { "Save Mid": [], "Good Help": [] },
    bad: { "Lost Mid": [], "Bad Help": [] },
    help: { Good: [], Normal: [], Bad: [] },
    boxoutGood: [],
    boxoutBad: [],
  };
}

export const goodEvents = (r: DefenseQualityRow) => [...r.good["Save Mid"], ...r.good["Good Help"], ...r.help.Good, ...r.boxoutGood];
export const badEvents = (r: DefenseQualityRow) => [...r.bad["Lost Mid"], ...r.bad["Bad Help"], ...r.help.Bad, ...r.boxoutBad];
/** Positive plays minus negative plays (Help "Normal" is neutral). */
export const netScore = (r: DefenseQualityRow) => goodEvents(r).length - badEvents(r).length;

/** Rows for players with at least one defensive-quality tag, weakest first. */
export function computeDefenseQualityRows(events: RawEvent[], teamId: string): DefenseQualityRow[] {
  const rows = new Map<string, DefenseQualityRow>();
  const row = (playerId: string) => {
    const r = rows.get(playerId) ?? emptyDefenseRow(playerId);
    rows.set(playerId, r);
    return r;
  };
  for (const e of events) {
    if (e.teamId !== teamId || !e.playerId) continue;
    if (e.eventType === "good_defense" && (GOOD_TYPES as readonly string[]).includes(e.defenseType ?? "")) {
      row(e.playerId).good[e.defenseType as (typeof GOOD_TYPES)[number]].push(e);
    } else if (e.eventType === "bad_defense" && (BAD_TYPES as readonly string[]).includes(e.defenseType ?? "")) {
      row(e.playerId).bad[e.defenseType as (typeof BAD_TYPES)[number]].push(e);
    } else if (e.eventType === "help_defense" && (HELP_GRADES as readonly string[]).includes(e.helpDefenseType ?? "")) {
      row(e.playerId).help[e.helpDefenseType as (typeof HELP_GRADES)[number]].push(e);
    } else if (e.eventType === "boxout" && e.boxoutType === "Good") {
      row(e.playerId).boxoutGood.push(e);
    } else if (e.eventType === "boxout" && e.boxoutType === "Bad") {
      row(e.playerId).boxoutBad.push(e);
    }
  }
  return [...rows.values()].sort(
    (a, b) => netScore(a) - netScore(b) || badEvents(b).length - badEvents(a).length || a.playerId.localeCompare(b.playerId)
  );
}

/** Team total row (all players merged). */
export function sumDefenseRows(rows: DefenseQualityRow[], playerId = "TOTAL"): DefenseQualityRow {
  const total = emptyDefenseRow(playerId);
  for (const r of rows) {
    for (const k of GOOD_TYPES) total.good[k].push(...r.good[k]);
    for (const k of BAD_TYPES) total.bad[k].push(...r.bad[k]);
    for (const k of HELP_GRADES) total.help[k].push(...r.help[k]);
    total.boxoutGood.push(...r.boxoutGood);
    total.boxoutBad.push(...r.boxoutBad);
  }
  return total;
}
