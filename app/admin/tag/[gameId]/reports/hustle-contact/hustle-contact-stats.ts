// Hustle Play and Physical Contact are both "bothTeams: true" event types —
// tagged against one team's player, but Physical Contact records BOTH
// participants (a second, opponent player) plus who won, so it can answer
// "who wins these battles" per Roland Beech's physical-contact research
// (see the taxonomy comment in lib/tag-events.ts) rather than just "who
// was involved."

import type { RawEvent } from "../game-summary/summary-stats";
import { PHYSICAL_CONTACT_TYPES } from "@/lib/tag-events";

export interface HustleRow {
  playerId: string;
  diving: RawEvent[];
  orebEffort: RawEvent[];
  drebEffort: RawEvent[];
  goodBump: RawEvent[];
  other: RawEvent[];
  total: RawEvent[];
}

/** "Good Bump" is tagged two ways — the direct `good_bump` shortcut button,
 * or Hustle Play with type "Good Bump" — both count as the same stat. */
export function computeHustleRows(events: RawEvent[], teamId: string, playerIds: string[]): HustleRow[] {
  const mine = events.filter(
    (e) => e.teamId === teamId && (e.eventType === "hustle_play" || e.eventType === "good_bump") && e.playerId
  );

  return playerIds
    .map((playerId) => {
      const playerEvents = mine.filter((e) => e.playerId === playerId);
      const diving = playerEvents.filter((e) => e.hustlePlayType === "Diving for Ball");
      const orebEffort = playerEvents.filter((e) => e.hustlePlayType === "Offensive Rebound Effort");
      const drebEffort = playerEvents.filter((e) => e.hustlePlayType === "Defensive Rebound Effort");
      const goodBump = playerEvents.filter(
        (e) => e.eventType === "good_bump" || e.hustlePlayType === "Good Bump"
      );
      const known = new Set([...diving, ...orebEffort, ...drebEffort, ...goodBump]);
      const other = playerEvents.filter((e) => !known.has(e));
      return { playerId, diving, orebEffort, drebEffort, goodBump, other, total: playerEvents };
    })
    .filter((row) => row.total.length > 0);
}

export interface ContactCell {
  wins: RawEvent[];
  losses: RawEvent[];
}

export interface ContactRow {
  playerId: string;
  byType: Map<string, ContactCell>;
  total: ContactCell;
}

function emptyCell(): ContactCell {
  return { wins: [], losses: [] };
}

/** Every physical_contact event names two participants (the tagged player
 * + physicalContactSecondPlayerId, always on the opponent team) and a
 * winner — so it's attributed to BOTH players' rows, one win one loss,
 * not just the one the event happens to be tagged under. */
export function computeContactRows(events: RawEvent[], teamId: string, playerIds: string[]): ContactRow[] {
  const contactEvents = events.filter((e) => e.eventType === "physical_contact" && e.physicalContactType);

  function addResult(
    byPlayer: Map<string, Map<string, ContactCell>>,
    playerId: string,
    type: string,
    won: boolean,
    e: RawEvent
  ) {
    let byType = byPlayer.get(playerId);
    if (!byType) {
      byType = new Map();
      byPlayer.set(playerId, byType);
    }
    const cell = byType.get(type) ?? emptyCell();
    (won ? cell.wins : cell.losses).push(e);
    byType.set(type, cell);
  }

  const byPlayer = new Map<string, Map<string, ContactCell>>();
  for (const e of contactEvents) {
    // No winner recorded — skip rather than count it as a loss for both
    // sides (winner is required by the tagging UI, but don't assume it).
    if (!e.physicalContactWinnerPlayerId) continue;
    const type = e.physicalContactType!;
    const winnerId = e.physicalContactWinnerPlayerId;
    if (e.playerId) addResult(byPlayer, e.playerId, type, winnerId === e.playerId, e);
    if (e.physicalContactSecondPlayerId) {
      addResult(byPlayer, e.physicalContactSecondPlayerId, type, winnerId === e.physicalContactSecondPlayerId, e);
    }
  }

  return playerIds
    .map((playerId) => {
      const byType = byPlayer.get(playerId) ?? new Map<string, ContactCell>();
      const total = emptyCell();
      for (const cell of byType.values()) {
        total.wins.push(...cell.wins);
        total.losses.push(...cell.losses);
      }
      return { playerId, byType, total };
    })
    .filter((row) => row.total.wins.length + row.total.losses.length > 0);
}

export { PHYSICAL_CONTACT_TYPES };
