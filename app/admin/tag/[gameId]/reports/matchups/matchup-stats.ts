// Defensive matchups: every 2pt/3pt attempt is tagged with which defender
// contested it (defender_player_id, from shot-detail-panel.tsx during
// tagging), so "who scored the most against whom" and "how many plays did
// each defender face" are direct reads, not inferred.

import type { RawEvent } from "../game-summary/summary-stats";

const SHOT_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);

export interface DefenderRow {
  playerId: string;
  twoPt: RawEvent[];
  threePt: RawEvent[];
  total: RawEvent[];
}

/** One row per defender on `playerIds` who faced at least one tagged shot
 * — every shot they were credited as the defender on, split 2PT/3PT. */
export function computeDefenderRows(events: RawEvent[], playerIds: string[]): DefenderRow[] {
  const shots = events.filter((e) => SHOT_TYPES.has(e.eventType) && e.defenderPlayerId);

  return playerIds
    .map((playerId) => {
      const mine = shots.filter((e) => e.defenderPlayerId === playerId);
      return {
        playerId,
        twoPt: mine.filter((e) => e.eventType.startsWith("2pt")),
        threePt: mine.filter((e) => e.eventType.startsWith("3pt")),
        total: mine,
      };
    })
    .filter((row) => row.total.length > 0);
}

export interface MatchupPair {
  shooterId: string;
  defenderId: string;
  events: RawEvent[];
}

export function pairPoints(pair: MatchupPair): number {
  return pair.events.reduce((s, e) => s + (e.points ?? 0), 0);
}

/** Shooter × defender pairs, most points scored first — "who scored the
 * most against whom." `defenderTeamRoster` scopes to real defenders on
 * that specific team (defensive against any stray/mistagged ids). */
export function computeMatchups(events: RawEvent[], defenderTeamRoster: Set<string>): MatchupPair[] {
  const shots = events.filter(
    (e) => SHOT_TYPES.has(e.eventType) && e.playerId && e.defenderPlayerId && defenderTeamRoster.has(e.defenderPlayerId)
  );

  const byPair = new Map<string, MatchupPair>();
  for (const e of shots) {
    const key = `${e.playerId}:${e.defenderPlayerId}`;
    const pair = byPair.get(key) ?? { shooterId: e.playerId!, defenderId: e.defenderPlayerId!, events: [] };
    pair.events.push(e);
    byPair.set(key, pair);
  }

  return [...byPair.values()].sort((a, b) => pairPoints(b) - pairPoints(a) || b.events.length - a.events.length);
}
