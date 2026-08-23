import type { RawEvent } from "../game-summary/summary-stats";
import { shotDistance } from "../game-summary/shooting-stats";

// The tagging half-court's viewBox units are calibrated so the standard
// FIBA measurements land on round numbers (rim restricted-area radius 40 =
// ~4 ft, 3PT arc radius 230 = ~23 ft) — so 1 unit ≈ 0.1 ft is a reasonable
// real-world distance estimate for the "Shot Distance" filter.
const FEET_PER_UNIT = 0.1;

const SHOT_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);
// How long after a miss to keep looking for the rebound/block that goes
// with it — long enough for a loose-ball scramble, short enough not to
// bleed into the next possession's own events.
const FOLLOWUP_WINDOW_SECONDS = 8;

export interface ShotEntry {
  event: RawEvent;
  isMade: boolean;
  is3pt: boolean;
  distanceFt: number;
  hasOReb: boolean;
  hasDReb: boolean;
  isBlocked: boolean;
  isFouled: boolean;
  isAssisted: boolean;
}

/** Reconstructs every shot attempt with derived flags (rebound/block
 * outcome, fouled, assisted) by scanning the events immediately following
 * each miss — there's no direct link between a shot and its rebound/block
 * in the schema, so this infers it from tagging order, same approach as
 * the FT-trip and possession detection elsewhere in these reports. */
export function buildShotEntries(rawEvents: RawEvent[]): ShotEntry[] {
  const sorted = [...rawEvents].sort((a, b) => a.t - b.t);
  const shots = sorted.filter((e) => SHOT_TYPES.has(e.eventType) && e.shotX !== null && e.shotY !== null);

  return shots.map((shot) => {
    const isMade = shot.eventType.endsWith("_made");
    const is3pt = shot.eventType.startsWith("3pt");
    const distanceFt = shotDistance(shot.shotX as number, shot.shotY as number) * FEET_PER_UNIT;

    let hasOReb = false;
    let hasDReb = false;
    let isBlocked = false;
    if (!isMade) {
      const idx = sorted.indexOf(shot);
      for (let i = idx + 1; i < sorted.length; i++) {
        const e = sorted[i];
        if (e.t - shot.t > FOLLOWUP_WINDOW_SECONDS) break;
        if (SHOT_TYPES.has(e.eventType) || e.eventType === "turnover") break;
        if (e.eventType === "off_reb" && e.teamId === shot.teamId) hasOReb = true;
        if (e.eventType === "def_reb" && e.teamId !== shot.teamId) hasDReb = true;
        if (e.eventType === "block") isBlocked = true;
      }
    }

    return {
      event: shot,
      isMade,
      is3pt,
      distanceFt,
      hasOReb,
      hasDReb,
      isBlocked,
      // Only detectable for made shots (the "and 1" modifier) — a shooting
      // foul on a miss isn't linked to the specific shot attempt.
      isFouled: isMade && shot.andOne,
      isAssisted: isMade && !!shot.assistPlayerId,
    };
  });
}
