// Per-row stats for the "Player & Lineup Stats" report — one player per
// row, plus an "ALL" team-total row. Reuses the same building blocks as
// the Game Summary report (on-court intervals, possession detection) but
// attributes everything to a player (or, for the ALL row, the whole team)
// instead of just a team-vs-team comparison.

import type { RawEvent } from "../game-summary/summary-stats";
import { computeOnCourtIntervals, type Interval } from "../game-summary/timeline-stats";
import { computePossessions, type PossessionSegment } from "../game-summary/pace-stats";

const FT_TYPES = new Set(["ft_made", "ft_miss"]);

export interface PlayerStats {
  playerId: string | null; // null for the team "ALL" row
  minSeconds: number;
  pts: number;
  ast: number;
  otherAssist: number;
  shots: number;
  opps: number;
  efgPct: number;
  fgm2: number;
  fga2: number;
  twoPtPct: number;
  twoPtFouled: number;
  fgm3: number;
  fga3: number;
  threePtPct: number;
  threePtFouled: number;
  ftm: number;
  fta: number;
  ftPct: number;
  ftTrips: number;
  tsPct: number;
  ftf: number;
  oreb: number;
  offFoul: number;
  offActionTag: number;
  to: number;
  forcedTo: number;
  lostTieUp: number;
  usagePct: number | null; // null for the ALL row — not a meaningful team-level stat
  offPPP: number;
  offPoss: number;
}

/** A run of consecutive ft_made/ft_miss events by the same player,
 * uninterrupted by any other event, counts as one trip (mirrors the
 * team-level version in shooting-stats.ts). */
function countFtTrips(chronological: RawEvent[], matches: (e: RawEvent) => boolean): number {
  let trips = 0;
  let streakMatched = false;
  for (const e of chronological) {
    if (FT_TYPES.has(e.eventType)) {
      const isMatch = matches(e);
      if (isMatch && !streakMatched) trips++;
      streakMatched = isMatch;
    } else {
      streakMatched = false;
    }
  }
  return trips;
}

function possessionPoints(events: RawEvent[], teamId: string, seg: PossessionSegment): number {
  return events
    .filter((e) => e.teamId === teamId && e.t >= seg.start && e.t <= seg.end && e.points)
    .reduce((s, e) => s + (e.points ?? 0), 0);
}

/**
 * Computes one row. Pass `playerId` for an individual player's row (minutes
 * and Usage%/Off PPP/Off Poss are scoped to their own on-court intervals);
 * omit it for the team "ALL" row (uses the team's full range instead — a
 * team is trivially "on the floor" for all of its own possessions).
 */
export function computePlayerStats(
  allEvents: RawEvent[],
  teamId: string,
  playerId: string | null,
  start: number,
  end: number,
  teamPossessions: PossessionSegment[]
): PlayerStats {
  const onCourtIntervals: Interval[] | null = playerId
    ? computeOnCourtIntervals(allEvents, playerId, teamId)
    : null;
  const clippedIntervals = onCourtIntervals
    ? onCourtIntervals
        .map((iv) => ({ start: Math.max(iv.start, start), end: Math.min(iv.end, end) }))
        .filter((iv) => iv.end > iv.start)
    : null;
  const minSeconds = clippedIntervals ? clippedIntervals.reduce((s, iv) => s + (iv.end - iv.start), 0) : end - start;

  const inRangeChrono = [...allEvents].filter((e) => e.t >= start && e.t <= end).sort((a, b) => a.t - b.t);
  const mine = inRangeChrono.filter((e) => e.teamId === teamId && (playerId ? e.playerId === playerId : true));

  const pts = mine.reduce((s, e) => s + (e.points ?? 0), 0);
  const ast =
    mine.filter((e) => e.eventType === "assist" || e.eventType === "other_assist").length +
    inRangeChrono.filter((e) => (playerId ? e.assistPlayerId === playerId : e.teamId === teamId && e.assistPlayerId)).length;
  const otherAssist = mine.filter((e) => e.eventType === "other_assist").length;

  const fgm2 = mine.filter((e) => e.eventType === "2pt_made").length;
  const fga2 = mine.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss").length;
  const twoPtFouled = mine.filter((e) => e.eventType === "2pt_made" && e.andOne).length;
  const fgm3 = mine.filter((e) => e.eventType === "3pt_made").length;
  const fga3 = mine.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss").length;
  const threePtFouled = mine.filter((e) => e.eventType === "3pt_made" && e.andOne).length;
  const fgm = fgm2 + fgm3;
  const fga = fga2 + fga3;
  const ftm = mine.filter((e) => e.eventType === "ft_made").length;
  const fta = mine.filter((e) => FT_TYPES.has(e.eventType)).length;
  const ftTrips = countFtTrips(
    inRangeChrono,
    (e) => e.teamId === teamId && (playerId ? e.playerId === playerId : true)
  );
  const oreb = mine.filter((e) => e.eventType === "off_reb").length;
  const offFoul = mine.filter((e) => e.eventType === "off_foul").length;
  const offActionTag = mine.filter((e) => e.eventType === "screen_set" || e.eventType === "screen_rcvd").length;
  const to = mine.filter((e) => e.eventType === "turnover").length;
  // Defensive credit — the defender tagged on a "Forced TO" event, distinct
  // from `to` above (that team's own giveaways).
  const forcedTo = mine.filter((e) => e.eventType === "forced_to").length;
  // Not attributable with the current taxonomy: "Tie Up" only records the
  // defender, not which offensive player lost the ball.
  const lostTieUp = 0;

  const shots = fga;
  const opps = fga + ftTrips;
  const efgPct = fga > 0 ? (fgm + 0.5 * fgm3) / fga : 0;
  const twoPtPct = fga2 > 0 ? fgm2 / fga2 : 0;
  const threePtPct = fga3 > 0 ? fgm3 / fga3 : 0;
  const ftPct = fta > 0 ? ftm / fta : 0;
  const tsPct = fga + fta > 0 ? pts / (2 * (fga + 0.44 * fta)) : 0;
  const ftf = shots > 0 ? ftTrips / shots : 0;

  // Off Poss/Off PPP/Usage%: the team's own possessions that fall in the
  // selected range and (for a player row) started while they were on the
  // floor. For the ALL row every one of the team's own possessions counts.
  const relevantPoss = teamPossessions.filter(
    (seg) =>
      seg.teamId === teamId &&
      seg.start >= start &&
      seg.start < end &&
      (clippedIntervals ? clippedIntervals.some((iv) => seg.start >= iv.start && seg.start < iv.end) : true)
  );
  const offPoss = relevantPoss.length;
  const offPossPoints = relevantPoss.reduce((s, seg) => s + possessionPoints(allEvents, teamId, seg), 0);
  const offPPP = offPoss > 0 ? offPossPoints / offPoss : 0;
  const endedByPlayer = shots + to + ftTrips + lostTieUp;
  // Usage% isn't a meaningful team-level number (a team "uses" 100% of its
  // own possessions by definition) — only computed for individual players.
  const usagePct = playerId && offPoss > 0 ? endedByPlayer / offPoss : null;

  return {
    playerId,
    minSeconds,
    pts,
    ast,
    otherAssist,
    shots,
    opps,
    efgPct,
    fgm2,
    fga2,
    twoPtPct,
    twoPtFouled,
    fgm3,
    fga3,
    threePtPct,
    threePtFouled,
    ftm,
    fta,
    ftPct,
    ftTrips,
    tsPct,
    ftf,
    oreb,
    offFoul,
    offActionTag,
    to,
    forcedTo,
    lostTieUp,
    usagePct,
    offPPP,
    offPoss,
  };
}

export { computePossessions, type PossessionSegment, type Interval };
