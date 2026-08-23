// Shot-type breakdown matrix for the Shot Analysis report: one row per
// player (plus an ALL team total row), one column per tagged shot type
// (Breakaway Layup, Catch and Shoot, ...), split by point value since a
// name like "Catch and Shoot" is tagged separately for 2s and 3s.

import type { RawEvent } from "../game-summary/summary-stats";
import { SHOT_TYPES_2PT, SHOT_TYPES_3PT } from "@/lib/tag-events";

export type ShotRange = "all" | "2pt" | "3pt";
export type ShotResult = "all" | "made" | "missed";

export interface ShotColumn {
  key: string; // "2:Catch and Shoot" / "3:Catch and Shoot"
  label: string; // "Catch and Shoot (2)"
}

/** Which columns to render, based on the Range filter — matches the
 * reference tool's "(2)"/"(3)" suffixed column names. */
export function buildColumns(range: ShotRange): ShotColumn[] {
  const cols: ShotColumn[] = [];
  if (range === "all" || range === "2pt") {
    for (const t of SHOT_TYPES_2PT) cols.push({ key: `2:${t}`, label: `${t} (2)` });
  }
  if (range === "all" || range === "3pt") {
    for (const t of SHOT_TYPES_3PT) cols.push({ key: `3:${t}`, label: `${t} (3)` });
  }
  return cols;
}

export interface CellStat {
  makes: number;
  attempts: number;
}

export interface ShotAnalysisRow {
  playerId: string | null; // null = the team ALL row
  byColumn: Map<string, CellStat>;
  uncategorized: CellStat;
  total: CellStat;
}

function emptyStat(): CellStat {
  return { makes: 0, attempts: 0 };
}

function matchesRange(e: RawEvent, range: ShotRange): boolean {
  const is2 = e.eventType === "2pt_made" || e.eventType === "2pt_miss";
  const is3 = e.eventType === "3pt_made" || e.eventType === "3pt_miss";
  if (!is2 && !is3) return false;
  if (range === "2pt") return is2;
  if (range === "3pt") return is3;
  return true;
}

function matchesResult(e: RawEvent, result: ShotResult): boolean {
  if (result === "all") return true;
  const made = e.eventType.endsWith("_made");
  return result === "made" ? made : !made;
}

/**
 * One row per player in `playerIds`, plus a final ALL row (team total —
 * always summed over every shot the team took in range, independent of
 * which players are passed in). `excludeFouled` drops and-1 makes from
 * every count, matching "percentages don't include fouled shots" — there's
 * no equivalent flag for a fouled miss in this taxonomy, so only the
 * and-1 (fouled make) case is actually excludable here.
 */
export function computeShotAnalysisRows(
  events: RawEvent[],
  teamId: string,
  playerIds: string[],
  range: ShotRange,
  result: ShotResult,
  start: number,
  end: number,
  excludeFouled: boolean
): ShotAnalysisRow[] {
  const inRange = events.filter(
    (e) =>
      e.teamId === teamId &&
      e.t >= start &&
      e.t <= end &&
      matchesRange(e, range) &&
      matchesResult(e, result) &&
      !(excludeFouled && e.andOne)
  );

  function computeFor(playerId: string | null): ShotAnalysisRow {
    const mine = playerId ? inRange.filter((e) => e.playerId === playerId) : inRange;
    const byColumn = new Map<string, CellStat>();
    const uncategorized = emptyStat();
    const total = emptyStat();

    for (const e of mine) {
      const made = e.eventType.endsWith("_made");
      const is2 = e.eventType.startsWith("2pt");
      const key = e.shotType ? `${is2 ? "2" : "3"}:${e.shotType}` : null;

      total.attempts++;
      if (made) total.makes++;

      const target = key ? (byColumn.get(key) ?? emptyStat()) : uncategorized;
      target.attempts++;
      if (made) target.makes++;
      if (key) byColumn.set(key, target);
    }

    return { playerId, byColumn, uncategorized, total };
  }

  return [...playerIds.map((id) => computeFor(id)), computeFor(null)];
}

/** The raw events behind one cell — for the click-to-clips drill-down.
 * Pass `columnKey: null` for the "(uncategorized)" cell, or `"total"` for
 * the row's "All" cell. `playerId: null` scopes to the whole team (the
 * ALL row). */
export function eventsForCell(
  events: RawEvent[],
  teamId: string,
  playerId: string | null,
  range: ShotRange,
  result: ShotResult,
  start: number,
  end: number,
  excludeFouled: boolean,
  columnKey: string | null | "total"
): RawEvent[] {
  const inRange = events.filter(
    (e) =>
      e.teamId === teamId &&
      e.t >= start &&
      e.t <= end &&
      matchesRange(e, range) &&
      matchesResult(e, result) &&
      !(excludeFouled && e.andOne) &&
      (playerId ? e.playerId === playerId : true)
  );
  if (columnKey === "total") return inRange;
  return inRange.filter((e) => {
    const is2 = e.eventType.startsWith("2pt");
    const key = e.shotType ? `${is2 ? "2" : "3"}:${e.shotType}` : null;
    return key === columnKey;
  });
}
