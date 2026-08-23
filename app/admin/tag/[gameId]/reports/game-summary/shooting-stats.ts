import type { RawEvent } from "./summary-stats";

// Shot-zone thresholds are distances (in HalfCourtDiagram's own 500x470
// viewBox units) from the rim at (250, 52) — matching the geometry already
// drawn there (the restricted-area arc is radius 40, which is reused here
// as the "at the rim" cutoff). shot_x/shot_y are stored as 0-1 normalized
// coordinates, so they're scaled back to viewBox units before measuring.
const RIM_X = 250;
const RIM_Y = 52;
export const RIM_RADIUS = 40;
export const SHORT_MID_RADIUS = 130;

export function shotDistance(x: number, y: number): number {
  return Math.hypot(x * 500 - RIM_X, y * 470 - RIM_Y);
}

export interface ShootingStats {
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  efgPct: number;
  tsPct: number;
  ftPct: number;
  scoringOpportunities: number;
  ftRate: number;
  ftTrips: number;
  atRimM: number;
  atRimA: number;
  atRimFouled: number;
  shortMidM: number;
  shortMidA: number;
  longMidM: number;
  longMidA: number;
  twoPtRate: number;
  threePtRate: number;
}

/** Counts distinct trips to the free-throw line: a run of consecutive
 * ft_made/ft_miss events for the same team, uninterrupted by any other
 * event, counts as one trip (2 shots off one shooting foul = 1 trip, not
 * 2) — there's no explicit "trip" tag, so this infers it from adjacency in
 * the event stream. */
function countFtTripsByTeam(chronological: RawEvent[]): Map<string, number> {
  const trips = new Map<string, number>();
  let streakTeam: string | null = null;
  for (const e of chronological) {
    if (e.eventType === "ft_made" || e.eventType === "ft_miss") {
      if (streakTeam !== e.teamId && e.teamId) {
        trips.set(e.teamId, (trips.get(e.teamId) ?? 0) + 1);
      }
      streakTeam = e.teamId;
    } else {
      streakTeam = null;
    }
  }
  return trips;
}

export function computeShootingStats(
  allEvents: RawEvent[],
  teamId: string,
  start: number,
  end: number
): ShootingStats {
  const inRangeChrono = [...allEvents]
    .filter((e) => e.t >= start && e.t <= end)
    .sort((a, b) => a.t - b.t);
  const inRange = inRangeChrono.filter((e) => e.teamId === teamId);

  const fgm2 = inRange.filter((e) => e.eventType === "2pt_made").length;
  const fga2 = inRange.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss").length;
  const fgm3 = inRange.filter((e) => e.eventType === "3pt_made").length;
  const fga3 = inRange.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss").length;
  const fgm = fgm2 + fgm3;
  const fga = fga2 + fga3;
  const ftm = inRange.filter((e) => e.eventType === "ft_made").length;
  const fta = inRange.filter((e) => e.eventType === "ft_made" || e.eventType === "ft_miss").length;
  const points = inRange.reduce((s, e) => s + (e.points ?? 0), 0);

  const efgPct = fga > 0 ? (fgm + 0.5 * fgm3) / fga : 0;
  const tsPct = fga + fta > 0 ? points / (2 * (fga + 0.44 * fta)) : 0;
  const ftPct = fta > 0 ? ftm / fta : 0;
  const ftRate = fga > 0 ? fta / fga : 0;
  const ftTrips = countFtTripsByTeam(inRangeChrono).get(teamId) ?? 0;
  const scoringOpportunities = fga + ftTrips;

  let atRimM = 0;
  let atRimA = 0;
  let atRimFouled = 0;
  let shortMidM = 0;
  let shortMidA = 0;
  let longMidM = 0;
  let longMidA = 0;
  for (const e of inRange) {
    if (e.eventType !== "2pt_made" && e.eventType !== "2pt_miss") continue;
    if (e.shotX === null || e.shotY === null) continue;
    const made = e.eventType === "2pt_made";
    const d = shotDistance(e.shotX, e.shotY);
    if (d <= RIM_RADIUS) {
      atRimA++;
      if (made) atRimM++;
      if (made && e.andOne) atRimFouled++;
    } else if (d <= SHORT_MID_RADIUS) {
      shortMidA++;
      if (made) shortMidM++;
    } else {
      longMidA++;
      if (made) longMidM++;
    }
  }

  const twoPtRate = fga > 0 ? fga2 / fga : 0;
  const threePtRate = fga > 0 ? fga3 / fga : 0;

  return {
    fgm2,
    fga2,
    fgm3,
    fga3,
    fgm,
    fga,
    ftm,
    fta,
    efgPct,
    tsPct,
    ftPct,
    scoringOpportunities,
    ftRate,
    ftTrips,
    atRimM,
    atRimA,
    atRimFouled,
    shortMidM,
    shortMidA,
    longMidM,
    longMidA,
    twoPtRate,
    threePtRate,
  };
}
