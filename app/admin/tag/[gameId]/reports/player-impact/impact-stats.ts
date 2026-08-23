// On/off impact for a player, pair, or trio: split the game into the
// combo's shared ON-court time (every member on the floor at once) and
// shared OFF-court time (every member on the bench at once), then compute
// the same rate stats for both windows so the client can show ON, OFF, or
// the NET (ON minus OFF) difference. Uses the same Four-Factors/PPP/Pace
// formulas already established for Game Summary (comparison-stats.ts,
// pace-stats.ts) so the numbers agree with the rest of the reports.

import type { RawEvent } from "../game-summary/summary-stats";
import { computeOnCourtIntervals, type Interval } from "../game-summary/timeline-stats";
import { intersectAll, unionAll, complement, totalDuration } from "./interval-ops";

const FTA_TYPES = new Set(["ft_made", "ft_miss"]);

interface WindowTotals {
  points: number;
  fgm2: number;
  fga2: number;
  fgm3: number;
  fga3: number;
  ftm: number;
  fta: number;
  to: number;
  oreb: number;
  dreb: number;
  steals: number;
  assists: number;
}

function inIntervals(t: number, intervals: Interval[]): boolean {
  return intervals.some((iv) => t >= iv.start && t < iv.end);
}

function windowTotals(events: RawEvent[], teamId: string, intervals: Interval[]): WindowTotals {
  const inRange = events.filter((e) => e.teamId === teamId && inIntervals(e.t, intervals));
  return {
    points: inRange.reduce((s, e) => s + (e.points ?? 0), 0),
    fgm2: inRange.filter((e) => e.eventType === "2pt_made").length,
    fga2: inRange.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss").length,
    fgm3: inRange.filter((e) => e.eventType === "3pt_made").length,
    fga3: inRange.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss").length,
    ftm: inRange.filter((e) => e.eventType === "ft_made").length,
    fta: inRange.filter((e) => FTA_TYPES.has(e.eventType)).length,
    to: inRange.filter((e) => e.eventType === "turnover").length,
    oreb: inRange.filter((e) => e.eventType === "off_reb").length,
    dreb: inRange.filter((e) => e.eventType === "def_reb").length,
    steals: inRange.filter((e) => e.eventType === "steal").length,
    assists:
      inRange.filter((e) => e.eventType === "assist" || e.eventType === "other_assist").length +
      inRange.filter((e) => e.assistPlayerId).length,
  };
}

export interface DerivedMetrics {
  points: number;
  oppPoints: number;
  efgPct: number;
  twoPtPct: number;
  threePtPct: number;
  ftRate: number; // "FTF" — FTA / FGA
  astToRatio: number | null; // null when there were no turnovers to divide by
  tovPct: number; // "TO %"
  orebPct: number;
  drebPct: number;
  rebPct: number;
  defTovPct: number;
  defTwoPtPct: number;
  defThreePtPct: number;
  stlPct: number;
  plusMinus: number;
  offPPP: number;
  defPPP: number;
  netPPP: number;
  pace: number; // avg of Off/Def Pace, possessions per 40 minutes
  offPace: number;
  defPace: number;
}

function deriveMetrics(seconds: number, mine: WindowTotals, opp: WindowTotals): DerivedMetrics {
  const fga = mine.fga2 + mine.fga3;
  const fgm = mine.fgm2 + mine.fgm3;
  const oppFga = opp.fga2 + opp.fga3;
  // Hollinger's possession estimate — same formula as comparison-stats.ts.
  const poss = Math.max(0, fga + 0.44 * mine.fta + mine.to - mine.oreb);
  const oppPoss = Math.max(0, oppFga + 0.44 * opp.fta + opp.to - opp.oreb);

  const efgPct = fga > 0 ? (fgm + 0.5 * mine.fgm3) / fga : 0;
  const twoPtPct = mine.fga2 > 0 ? mine.fgm2 / mine.fga2 : 0;
  const threePtPct = mine.fga3 > 0 ? mine.fgm3 / mine.fga3 : 0;
  const ftRate = fga > 0 ? mine.fta / fga : 0;
  const astToRatio = mine.to > 0 ? mine.assists / mine.to : null;
  const tovPct = poss > 0 ? mine.to / poss : 0;
  const orebPct = mine.oreb + opp.dreb > 0 ? mine.oreb / (mine.oreb + opp.dreb) : 0;
  const drebPct = mine.dreb + opp.oreb > 0 ? mine.dreb / (mine.dreb + opp.oreb) : 0;
  const rebPct =
    mine.oreb + mine.dreb + opp.oreb + opp.dreb > 0
      ? (mine.oreb + mine.dreb) / (mine.oreb + mine.dreb + opp.oreb + opp.dreb)
      : 0;
  const defTovPct = oppPoss > 0 ? opp.to / oppPoss : 0;
  const defTwoPtPct = opp.fga2 > 0 ? opp.fgm2 / opp.fga2 : 0;
  const defThreePtPct = opp.fga3 > 0 ? opp.fgm3 / opp.fga3 : 0;
  const stlPct = oppPoss > 0 ? mine.steals / oppPoss : 0;
  const plusMinus = mine.points - opp.points;
  const offPPP = poss > 0 ? mine.points / poss : 0;
  const defPPP = oppPoss > 0 ? opp.points / oppPoss : 0;
  const netPPP = offPPP - defPPP;
  const minutes = seconds / 60;
  const offPace = minutes > 0 ? (poss / minutes) * 40 : 0;
  const defPace = minutes > 0 ? (oppPoss / minutes) * 40 : 0;
  const pace = (offPace + defPace) / 2;

  return {
    points: mine.points,
    oppPoints: opp.points,
    efgPct,
    twoPtPct,
    threePtPct,
    ftRate,
    astToRatio,
    tovPct,
    orebPct,
    drebPct,
    rebPct,
    defTovPct,
    defTwoPtPct,
    defThreePtPct,
    stlPct,
    plusMinus,
    offPPP,
    defPPP,
    netPPP,
    pace,
    offPace,
    defPace,
  };
}

export interface ComboRow {
  playerIds: string[];
  onSeconds: number;
  offSeconds: number;
  /** The combo's actual shared on-court windows — for the "Time" column's
   * clip drill-down (which events happened while they were all out there). */
  onIntervals: Interval[];
  on: DerivedMetrics;
  off: DerivedMetrics;
}

/** One row: the combo's ON window (all members on court together) vs its
 * OFF window (all members on the bench together) — partial-overlap time
 * (some in, some out) counts toward neither. */
export function computeComboRow(
  events: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  playerIds: string[],
  gameStart: number,
  gameEnd: number
): ComboRow {
  const perPlayer = playerIds.map((id) => computeOnCourtIntervals(events, id, teamId));
  const onIntervals = intersectAll(perPlayer);
  const anyOnIntervals = unionAll(perPlayer);
  const offIntervals = complement(anyOnIntervals, gameStart, gameEnd);

  const onSeconds = totalDuration(onIntervals);
  const offSeconds = totalDuration(offIntervals);

  return {
    playerIds,
    onSeconds,
    offSeconds,
    onIntervals,
    on: deriveMetrics(onSeconds, windowTotals(events, teamId, onIntervals), windowTotals(events, opponentTeamId, onIntervals)),
    off: deriveMetrics(
      offSeconds,
      windowTotals(events, teamId, offIntervals),
      windowTotals(events, opponentTeamId, offIntervals)
    ),
  };
}

/** A player counts as "in the game" if they have at least one recorded
 * on-court interval — combos are only built from players who actually
 * played, matching the reference tool's "up to N" combo counts. */
export function didPlay(events: RawEvent[], teamId: string, playerId: string): boolean {
  return computeOnCourtIntervals(events, playerId, teamId).length > 0;
}
