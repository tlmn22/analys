// Shared "how open was the shot" building blocks — how closely a defender
// contested a shot, and how open a shooter was — used by both the 3PT
// Contest report (scoped to 3PT only) and Player Defender Detail (all 2PT +
// 3PT attempts, "1v1 defense" across the whole floor). shot-detail-panel.tsx's
// contest-distance checkboxes (contestedClose < 0.6m, lightlyContested <
// 1.2m, uncontested < 1.8m, wideOpen > 1.8m) are meant to be mutually
// exclusive distance bands picked per shot.

import type { RawEvent } from "./game-summary/summary-stats";

export type ContestTier = "Contested" | "Lightly Contested" | "Uncontested" | "Wide Open" | "Unmarked";

export const CONTEST_TIERS: ContestTier[] = [
  "Contested",
  "Lightly Contested",
  "Uncontested",
  "Wide Open",
  "Unmarked",
];

// Display labels — matches SHOT_MODIFIERS' distance bands in
// lib/tag-events.ts. Wide Open has no upper bound (> 1.8m), so it gets a
// descriptive gloss instead of a number.
export const CONTEST_TIER_LABELS: Record<ContestTier, string> = {
  Contested: "Contested (0.6м)",
  "Lightly Contested": "Lightly Contested (1.2м)",
  Uncontested: "Uncontested (1.8м)",
  "Wide Open": "Wide Open (Сув сул)",
  Unmarked: "Unmarked",
};

export function contestTier(e: RawEvent): ContestTier {
  if (e.contestedClose) return "Contested";
  if (e.lightlyContested) return "Lightly Contested";
  if (e.uncontested) return "Uncontested";
  if (e.wideOpen) return "Wide Open";
  return "Unmarked";
}

export type ShotRangeFilter = "all" | "2pt" | "3pt";

const TWO_PT_TYPES = new Set(["2pt_made", "2pt_miss"]);
const THREE_PT_TYPES = new Set(["3pt_made", "3pt_miss"]);

function matchesRange(e: RawEvent, range: ShotRangeFilter): boolean {
  if (range === "2pt") return TWO_PT_TYPES.has(e.eventType);
  if (range === "3pt") return THREE_PT_TYPES.has(e.eventType);
  return TWO_PT_TYPES.has(e.eventType) || THREE_PT_TYPES.has(e.eventType);
}

export interface ContestCell {
  makes: number;
  attempts: number;
  events: RawEvent[];
}

/** One row per player — either the shooter (Offense) or the defender who
 * contested (Defense); which one `playerId` refers to depends on which
 * builder produced it, see below. */
export interface PlayerContestRow {
  playerId: string;
  byTier: Map<ContestTier, ContestCell>;
  total: ContestCell;
}

function emptyCell(): ContestCell {
  return { makes: 0, attempts: 0, events: [] };
}

function aggregateByTier(shots: RawEvent[]): { byTier: Map<ContestTier, ContestCell>; total: ContestCell } {
  const byTier = new Map<ContestTier, ContestCell>();
  const total = emptyCell();
  for (const e of shots) {
    const tier = contestTier(e);
    const cell = byTier.get(tier) ?? emptyCell();
    const made = e.eventType.endsWith("_made");
    cell.attempts++;
    total.attempts++;
    if (made) {
      cell.makes++;
      total.makes++;
    }
    cell.events.push(e);
    total.events.push(e);
    byTier.set(tier, cell);
  }
  return { byTier, total };
}

/** One row per defender in `defenderIds` who contested at least one
 * attempt in `range` — every tagged shot they were credited as the
 * defender on, split by how close that contest was. Rows with zero
 * attempts faced are dropped. */
export function computeDefenderContestRows(
  events: RawEvent[],
  defenderIds: string[],
  range: ShotRangeFilter = "all"
): PlayerContestRow[] {
  const shots = events.filter((e) => matchesRange(e, range) && e.defenderPlayerId);

  return defenderIds
    .map((defenderId) => ({
      playerId: defenderId,
      ...aggregateByTier(shots.filter((e) => e.defenderPlayerId === defenderId)),
    }))
    .filter((row) => row.total.attempts > 0);
}

/** One row per shooter in `shooterIds` who took at least one attempt in
 * `range` — split by how open they were when they shot it, the
 * offense-side mirror of computeDefenderContestRows. Rows with zero
 * attempts taken are dropped. */
export function computeShooterContestRows(
  events: RawEvent[],
  shooterIds: string[],
  range: ShotRangeFilter = "all"
): PlayerContestRow[] {
  const shots = events.filter((e) => matchesRange(e, range) && e.playerId);

  return shooterIds
    .map((shooterId) => ({
      playerId: shooterId,
      ...aggregateByTier(shots.filter((e) => e.playerId === shooterId)),
    }))
    .filter((row) => row.total.attempts > 0);
}
