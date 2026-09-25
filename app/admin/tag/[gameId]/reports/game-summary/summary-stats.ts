// Reconstructs the per-period score table and the running score/margin
// series from the raw game_events log. Scales with however many periods
// have actually been tagged — 1 now, 4 (+OT) once the whole game is done —
// nothing here assumes a fixed number of periods.

/** Matches the game clock's period length assumption in video-panel.tsx
 * (10-minute periods reset at "End Quarter"). Used only to place events on
 * a continuous "elapsed game time" axis for the charts below. */
export const PERIOD_SECONDS = 600;

export interface RawScoringEvent {
  period: number;
  clockTime: number;
  teamId: string | null;
  points: number | null;
}

/** Single shared shape for one game_events row, carrying everything any
 * game-summary sub-report might need — comparison/pace/shooting stats all
 * consume this same array so the page only has to build it once. */
export interface RawEvent {
  id: string;
  videoTime: number;
  t: number; // elapsed seconds from tip-off, see elapsedSeconds()
  period: number;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  assistPlayerId: string | null;
  points: number | null;
  shotType: string | null;
  shotX: number | null;
  shotY: number | null;
  andOne: boolean;
  // Optional — only populated by reports that actually query these
  // columns; every other report's page.tsx simply omits them.
  hustlePlayType?: string | null;
  physicalContactType?: string | null;
  physicalContactSecondPlayerId?: string | null;
  physicalContactWinnerPlayerId?: string | null;
  screenSetType?: string | null;
  screenRcvdType?: string | null;
  screenerPlayerId?: string | null;
  screenTargetPlayerId?: string | null;
  offActionType?: string | null;
  defCoverageType?: string | null;
  defOffballType?: string | null;
  defenderPlayerId?: string | null;
  manToManType?: string | null;
  zoneType?: string | null;
  pressType?: string | null;
  contestedClose?: boolean;
  lightlyContested?: boolean;
  uncontested?: boolean;
  wideOpen?: boolean;
  foulType?: string | null;
  foulFiftyFifty?: boolean;
  foulBadCall?: boolean;
  foulCorrectCall?: boolean;
  setOffenseName?: string | null;
}

export interface PeriodTotal {
  period: number;
  homePts: number;
  visitorPts: number;
}

export interface ScorePoint {
  t: number; // elapsed seconds from tip-off (period 1, clock 10:00)
  homeScore: number;
  visitorScore: number;
}

export interface GameSummaryData {
  periods: number[];
  periodTotals: PeriodTotal[];
  finalHome: number;
  finalVisitor: number;
  points: ScorePoint[];
  maxSeconds: number;
}

export function elapsedSeconds(e: { period: number; clockTime: number }): number {
  return (e.period - 1) * PERIOD_SECONDS + (PERIOD_SECONDS - e.clockTime);
}

/** Clips/interpolates a running-score step series to [start, end], carrying
 * the last-known value across the boundary so a chart or stat zoomed into a
 * single period still reads the correct score at its edges. */
export function clipScorePoints(points: ScorePoint[], start: number, end: number): ScorePoint[] {
  const before = [...points].reverse().find((p) => p.t <= start) ?? points[0];
  const inRange = points.filter((p) => p.t > start && p.t < end);
  const after = [...points].reverse().find((p) => p.t <= end) ?? points[points.length - 1];
  return [{ ...before, t: start }, ...inRange, { ...after, t: end }];
}

export function computeGameSummary(
  events: RawScoringEvent[],
  homeTeamId: string,
  visitorTeamId: string
): GameSummaryData {
  const periodsSet = new Set<number>();
  for (const e of events) periodsSet.add(e.period);
  const periods = [...periodsSet].sort((a, b) => a - b);
  const maxPeriod = periods.length ? Math.max(...periods) : 1;
  const maxSeconds = maxPeriod * PERIOD_SECONDS;

  const scoring = events
    .filter((e) => e.points && e.points > 0 && e.teamId)
    .map((e) => ({ ...e, t: elapsedSeconds(e) }))
    .sort((a, b) => a.t - b.t);

  const periodTotals: PeriodTotal[] = periods.map((p) => {
    let homePts = 0;
    let visitorPts = 0;
    for (const e of scoring) {
      if (e.period !== p) continue;
      if (e.teamId === homeTeamId) homePts += e.points!;
      else if (e.teamId === visitorTeamId) visitorPts += e.points!;
    }
    return { period: p, homePts, visitorPts };
  });

  const finalHome = periodTotals.reduce((s, p) => s + p.homePts, 0);
  const finalVisitor = periodTotals.reduce((s, p) => s + p.visitorPts, 0);

  const points: ScorePoint[] = [{ t: 0, homeScore: 0, visitorScore: 0 }];
  let h = 0;
  let v = 0;
  for (const e of scoring) {
    if (e.teamId === homeTeamId) h += e.points!;
    else if (e.teamId === visitorTeamId) v += e.points!;
    points.push({ t: e.t, homeScore: h, visitorScore: v });
  }
  const last = points[points.length - 1];
  if (last.t < maxSeconds) {
    points.push({ t: maxSeconds, homeScore: last.homeScore, visitorScore: last.visitorScore });
  }

  return { periods, periodTotals, finalHome, finalVisitor, points, maxSeconds };
}
