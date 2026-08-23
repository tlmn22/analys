import { clipScorePoints, type RawEvent, type ScorePoint } from "./summary-stats";

const FGA_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);
const FTA_TYPES = new Set(["ft_made", "ft_miss"]);

export interface ComparisonTeamStats {
  points: number;
  fga: number;
  fgm: number;
  fg3m: number;
  fta: number;
  to: number;
  oreb: number;
  dreb: number;
  poss: number;
  ppp: number;
  biggestLead: number;
  timeouts: number;
}

/** Possessions estimated with the standard FGA + 0.44*FTA + TO - OREB
 * formula (John Hollinger's estimate) — the only inputs this tagging setup
 * can actually produce without live possession-by-possession tracking. */
export function computeComparisonStats(
  events: RawEvent[],
  scorePoints: ScorePoint[],
  teamId: string,
  isHome: boolean,
  start: number,
  end: number
): ComparisonTeamStats {
  const inRange = events.filter((e) => e.teamId === teamId && e.t >= start && e.t <= end);
  const points = inRange.reduce((s, e) => s + (e.points ?? 0), 0);
  const fga = inRange.filter((e) => FGA_TYPES.has(e.eventType)).length;
  const fgm = inRange.filter((e) => e.eventType === "2pt_made" || e.eventType === "3pt_made").length;
  const fg3m = inRange.filter((e) => e.eventType === "3pt_made").length;
  const fta = inRange.filter((e) => FTA_TYPES.has(e.eventType)).length;
  const to = inRange.filter((e) => e.eventType === "turnover").length;
  const oreb = inRange.filter((e) => e.eventType === "off_reb").length;
  const dreb = inRange.filter((e) => e.eventType === "def_reb").length;
  const timeouts = inRange.filter((e) => e.eventType === "timeout").length;
  const poss = Math.max(0, fga + 0.44 * fta + to - oreb);
  const ppp = poss > 0 ? points / poss : 0;

  const clipped = clipScorePoints(scorePoints, start, end);
  const biggestLead = Math.max(
    ...clipped.map((p) => (isHome ? p.homeScore - p.visitorScore : p.visitorScore - p.homeScore))
  );

  return { points, fga, fgm, fg3m, fta, to, oreb, dreb, poss, ppp, biggestLead, timeouts };
}

export interface FourFactors {
  efgPct: number; // 0-1
  tovPct: number; // 0-1, share of possessions ending in a turnover
  orebPct: number; // 0-1, share of own-team missed FGs recovered
  ftRate: number; // FTA / FGA
}

/** Dean Oliver's "Four Factors": eFG% = (FGM + 0.5*3PM)/FGA, TOV% = TO/POSS,
 * OREB% = OREB/(OREB + opponent's DREB), FT Rate = FTA/FGA. OREB% needs the
 * opponent's defensive rebounds, so both teams' stats are passed in. */
export function computeFourFactors(team: ComparisonTeamStats, opponent: ComparisonTeamStats): FourFactors {
  const efgPct = team.fga > 0 ? (team.fgm + 0.5 * team.fg3m) / team.fga : 0;
  const tovPct = team.poss > 0 ? team.to / team.poss : 0;
  const orebDenom = team.oreb + opponent.dreb;
  const orebPct = orebDenom > 0 ? team.oreb / orebDenom : 0;
  const ftRate = team.fga > 0 ? team.fta / team.fga : 0;
  return { efgPct, tovPct, orebPct, ftRate };
}
