// Score-level numbers shown on the expert analysis card. Computed from the
// tagged events at render time (and by scripts/game-analysis-data.mjs), so
// the card always matches the game's current tags.

export interface FourFactors {
  eFGPct: number; // (FGM + 0.5 * 3PM) / FGA
  tovPct: number; // turnovers per 100 possessions
  orbPct: number; // OREB / (OREB + opponent DREB)
  ftRate: number; // FTA / FGA
}

interface CountEvent {
  eventType: string;
  teamId: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeFourFactors(events: CountEvent[], teamId: string, opponentTeamId: string, possessions: number): FourFactors {
  const count = (team: string, type: string) => events.filter((e) => e.teamId === team && e.eventType === type).length;
  const fgm2 = count(teamId, "2pt_made"), fgm3 = count(teamId, "3pt_made");
  const fga = fgm2 + fgm3 + count(teamId, "2pt_miss") + count(teamId, "3pt_miss");
  const fta = count(teamId, "ft_made") + count(teamId, "ft_miss");
  const oreb = count(teamId, "off_reb");
  const oppDreb = count(opponentTeamId, "def_reb");
  return {
    eFGPct: fga ? round1(((fgm2 + fgm3 + 0.5 * fgm3) / fga) * 100) : 0,
    tovPct: possessions ? round1((count(teamId, "turnover") / possessions) * 100) : 0,
    orbPct: oreb + oppDreb ? round1((oreb / (oreb + oppDreb)) * 100) : 0,
    ftRate: fga ? Math.round((fta / fga) * 100) / 100 : 0,
  };
}

/** Points per period ("Q1".."Q4", then "OT1"...), every period that has events. */
export function computePeriodScores(
  events: { period: number; teamId: string | null; points: number | null }[],
  homeTeamId: string,
  visitorTeamId: string
): { label: string; home: number; visitor: number }[] {
  const last = Math.max(0, ...events.map((e) => e.period));
  return Array.from({ length: last }, (_, i) => {
    const period = i + 1;
    const inPeriod = events.filter((e) => e.period === period);
    const sum = (team: string) => inPeriod.reduce((s, e) => s + (e.teamId === team ? e.points ?? 0 : 0), 0);
    return { label: period <= 4 ? `Q${period}` : `OT${period - 4}`, home: sum(homeTeamId), visitor: sum(visitorTeamId) };
  });
}
