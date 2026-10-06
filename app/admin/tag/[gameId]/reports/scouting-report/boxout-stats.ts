// Box out quality per player — Boxout tags carry "Good"/"Bad" (boxout_type)
// and are tied to whichever on-court player was picked, either team.

import type { RawEvent } from "../game-summary/summary-stats";

export interface BoxoutRow {
  playerId: string;
  good: RawEvent[];
  bad: RawEvent[];
}

export interface BoxoutSummary {
  rows: BoxoutRow[]; // most bad box outs first
  good: RawEvent[];
  bad: RawEvent[];
  /** Opponent offensive rebounds — what a missed box out usually costs. */
  opponentOreb: RawEvent[];
}

export function computeBoxoutSummary(events: RawEvent[], teamId: string, opponentTeamId: string): BoxoutSummary {
  const byPlayer = new Map<string, BoxoutRow>();
  const good: RawEvent[] = [];
  const bad: RawEvent[] = [];
  for (const e of events) {
    if (e.eventType !== "boxout" || e.teamId !== teamId || !e.playerId) continue;
    const row = byPlayer.get(e.playerId) ?? { playerId: e.playerId, good: [], bad: [] };
    if (e.boxoutType === "Bad") {
      row.bad.push(e);
      bad.push(e);
    } else if (e.boxoutType === "Good") {
      row.good.push(e);
      good.push(e);
    } else continue;
    byPlayer.set(e.playerId, row);
  }
  const rows = [...byPlayer.values()].sort(
    (a, b) => b.bad.length - a.bad.length || a.good.length - b.good.length || a.playerId.localeCompare(b.playerId)
  );
  const opponentOreb = events.filter((e) => e.eventType === "off_reb" && e.teamId === opponentTeamId);
  return { rows, good, bad, opponentOreb };
}

/** Share of good box outs, or null when none were tagged. */
export function boxoutRate(good: number, bad: number): number | null {
  return good + bad > 0 ? good / (good + bad) : null;
}
