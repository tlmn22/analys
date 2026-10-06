// Reconstructs possession boundaries from the raw event stream — there's no
// explicit "possession" tag in this taxonomy, so this applies the standard
// basketball-analytics definition to the events we do capture: a
// possession ends when the possessing team scores, turns it over, or the
// other team grabs a defensive rebound off their miss. An offensive
// rebound explicitly does NOT end a possession — same team continues.

import { DEFENSE, DEFENSE_TEAM_SETS } from "@/lib/tag-events";

// Events tagged against the defending team — when one of these opens a
// period (e.g. a Zone call before the first shot), the opponent has the ball.
// Def Reb/Steal are left out: the loop below already hands them the ball.
const DEF_SIDE_TYPES = new Set(
  [...DEFENSE, ...DEFENSE_TEAM_SETS]
    .filter((e) => e.side === "def" && e.type !== "def_reb" && e.type !== "steal")
    .map((e) => e.type)
);

export interface PossessionSegment {
  teamId: string;
  start: number;
  end: number;
}

const POSSESSION_END_TYPES = new Set(["2pt_made", "3pt_made", "ft_made", "turnover"]);

export function computePossessions(
  events: { t: number; period: number; eventType: string; teamId: string | null }[],
  homeTeamId: string,
  visitorTeamId: string
): PossessionSegment[] {
  function other(teamId: string): string {
    return teamId === homeTeamId ? visitorTeamId : homeTeamId;
  }

  const byPeriod = new Map<number, typeof events>();
  for (const e of events) {
    if (!e.teamId) continue;
    const arr = byPeriod.get(e.period);
    if (arr) arr.push(e);
    else byPeriod.set(e.period, [e]);
  }

  const segments: PossessionSegment[] = [];

  for (const periodEvents of byPeriod.values()) {
    const sorted = [...periodEvents].sort((a, b) => a.t - b.t);
    if (!sorted.length) continue;

    const first = sorted[0];
    let currentTeam: string | null = DEF_SIDE_TYPES.has(first.eventType) ? other(first.teamId!) : first.teamId;
    let possStart = sorted[0].t;

    for (const e of sorted) {
      // A steal hands the ball over just like a defensive rebound; a Turnover
      // tagged for the same play is then ignored (no longer the current team).
      if ((e.eventType === "def_reb" || e.eventType === "steal") && e.teamId && e.teamId !== currentTeam) {
        segments.push({ teamId: currentTeam!, start: possStart, end: e.t });
        currentTeam = e.teamId;
        possStart = e.t;
      } else if (POSSESSION_END_TYPES.has(e.eventType) && e.teamId === currentTeam) {
        segments.push({ teamId: currentTeam!, start: possStart, end: e.t });
        currentTeam = other(currentTeam!);
        possStart = e.t;
      }
      // off_reb and everything else: possession continues, no boundary.
    }

    const lastT = sorted[sorted.length - 1].t;
    if (currentTeam && lastT > possStart) {
      segments.push({ teamId: currentTeam, start: possStart, end: lastT });
    }
  }

  return segments;
}

export interface PaceStats {
  avgPossessionLength: number; // seconds
  timeOfPossession: number; // seconds
  possessions: number;
}

export function computePaceStats(
  segments: PossessionSegment[],
  teamId: string,
  start: number,
  end: number
): PaceStats {
  const inRange = segments.filter((s) => s.teamId === teamId && s.start >= start && s.start < end);
  const timeOfPossession = inRange.reduce((sum, s) => sum + (s.end - s.start), 0);
  const possessions = inRange.length;
  const avgPossessionLength = possessions > 0 ? timeOfPossession / possessions : 0;
  return { avgPossessionLength, timeOfPossession, possessions };
}
