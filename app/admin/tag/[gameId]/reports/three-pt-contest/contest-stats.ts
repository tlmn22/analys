// 3PT-scoped wrapper around the shared defender-contest building blocks —
// see ../defender-contest-stats.ts for the full explanation. Player
// Defender Detail uses the same underlying functions scoped to all shots
// instead of just 3PT.

import type { RawEvent } from "../game-summary/summary-stats";
import {
  computeDefenderContestRows as computeDefenderContestRowsGeneric,
  computeShooterContestRows as computeShooterContestRowsGeneric,
} from "../defender-contest-stats";

export {
  CONTEST_TIERS,
  CONTEST_TIER_LABELS,
  contestTier,
  type ContestTier,
  type ContestCell,
  type PlayerContestRow,
} from "../defender-contest-stats";

export function computeDefenderContestRows(events: RawEvent[], defenderIds: string[]) {
  return computeDefenderContestRowsGeneric(events, defenderIds, "3pt");
}

export function computeShooterContestRows(events: RawEvent[], shooterIds: string[]) {
  return computeShooterContestRowsGeneric(events, shooterIds, "3pt");
}
