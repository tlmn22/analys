// Starters vs bench. Starters are whoever was on the floor when period 1
// tipped off — tagged either as "lineup_set" (Pick 5 Players) or as sub_in
// events at the opening clock, depending on how the game was tagged.

export interface LineupEvent {
  period: number;
  clockTime: number;
  videoTime: number;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
}

/** Player ids on the floor for `teamId` at the start of period 1. */
export function computeStarters(events: LineupEvent[], teamId: string): Set<string> {
  const first = events
    .filter((e) => e.period === 1 && e.teamId === teamId)
    .sort((a, b) => b.clockTime - a.clockTime || a.videoTime - b.videoTime);
  const starters = new Set<string>();
  if (!first.length) return starters;
  const openingClock = first[0].clockTime;
  for (const e of first) {
    if (e.clockTime < openingClock) break;
    if (!e.playerId) continue;
    if (e.eventType === "lineup_set" || e.eventType === "sub_in") starters.add(e.playerId);
    else if (e.eventType === "sub_out") starters.delete(e.playerId);
  }
  return starters;
}

export interface RotationGroup {
  players: { playerId: string; pts: number; minSeconds: number }[]; // most points first
  points: number;
}

export function splitRotation(
  stats: { playerId: string; pts: number; minSeconds: number }[],
  starters: Set<string>
): { starters: RotationGroup; bench: RotationGroup } {
  const group = (rows: typeof stats): RotationGroup => ({
    players: [...rows].sort((a, b) => b.pts - a.pts || b.minSeconds - a.minSeconds),
    points: rows.reduce((s, r) => s + r.pts, 0),
  });
  return {
    starters: group(stats.filter((s) => starters.has(s.playerId))),
    bench: group(stats.filter((s) => !starters.has(s.playerId))),
  };
}
