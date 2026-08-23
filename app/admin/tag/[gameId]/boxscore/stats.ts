// Reconstructs per-player box-score stats from the raw game_events log.
//
// MIN and +/- need to know exactly which players were on the floor at every
// moment. "lineup_set" (logged once per player whenever Pick 5 Players is
// used) and "sub_in"/"sub_out" (logged as a pair on every mid-game swap) are
// the only events that carry that timing information — see tag-workspace.tsx.
//
// Within a single period the game clock only ever counts down, so events are
// walked in descending clock_time order to get chronological order without
// needing to know the period length. Periods are processed independently and
// summed, which also sidesteps not knowing the period length at all.

export interface PlayerBoxScore {
  playerId: string;
  minSeconds: number;
  pts: number;
  fg2m: number;
  fg2a: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  pf: number;
  to: number;
  stl: number;
  blk: number;
  plusMinus: number;
}

export interface RawGameEvent {
  period: number;
  clockTime: number;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  assistPlayerId?: string | null;
}

function emptyStat(playerId: string): PlayerBoxScore {
  return {
    playerId,
    minSeconds: 0,
    pts: 0,
    fg2m: 0,
    fg2a: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    ast: 0,
    pf: 0,
    to: 0,
    stl: 0,
    blk: 0,
    plusMinus: 0,
  };
}

export function computeBoxScore(
  events: RawGameEvent[],
  homeTeamId: string,
  visitorTeamId: string
): Map<string, PlayerBoxScore> {
  const stats = new Map<string, PlayerBoxScore>();
  function get(playerId: string) {
    let s = stats.get(playerId);
    if (!s) {
      s = emptyStat(playerId);
      stats.set(playerId, s);
    }
    return s;
  }

  const byPeriod = new Map<number, RawGameEvent[]>();
  for (const e of events) {
    const arr = byPeriod.get(e.period);
    if (arr) arr.push(e);
    else byPeriod.set(e.period, [e]);
  }

  // Periods must be walked in ascending order (not raw insertion order,
  // which follows however `events` was fetched) so on-court state can be
  // carried from one period's end into the next period's start below.
  const periodNumbers = [...byPeriod.keys()].sort((a, b) => a - b);

  // Players still on the floor at a period's end carry into the next
  // period's start even if the analyst doesn't re-run "Pick 5 Players" —
  // most lineups are unchanged going into a new quarter, and without this
  // they'd silently get 0 MIN/+- for every period after the first.
  let carryOnCourt: Record<string, Set<string>> = {
    [homeTeamId]: new Set(),
    [visitorTeamId]: new Set(),
  };

  for (const period of periodNumbers) {
    const periodEvents = byPeriod.get(period)!;
    const sorted = [...periodEvents].sort((a, b) => b.clockTime - a.clockTime);
    const onCourt: Record<string, Map<string, number>> = {
      [homeTeamId]: new Map(),
      [visitorTeamId]: new Map(),
    };

    function closeOut(teamId: string, playerId: string, atClock: number) {
      const enter = onCourt[teamId]?.get(playerId);
      if (enter !== undefined) {
        get(playerId).minSeconds += Math.max(0, enter - atClock);
        onCourt[teamId].delete(playerId);
      }
    }

    const periodStartClock = sorted.length ? sorted[0].clockTime : 0;
    for (const teamId of [homeTeamId, visitorTeamId]) {
      for (const pid of carryOnCourt[teamId]) {
        onCourt[teamId].set(pid, periodStartClock);
      }
    }

    let lastClock = periodStartClock;

    for (const e of sorted) {
      lastClock = e.clockTime;

      if (e.teamId && e.playerId && onCourt[e.teamId]) {
        if (e.eventType === "lineup_set" || e.eventType === "sub_in") {
          onCourt[e.teamId].set(e.playerId, e.clockTime);
        } else if (e.eventType === "sub_out") {
          closeOut(e.teamId, e.playerId, e.clockTime);
        }
      }

      if (e.playerId) {
        const s = get(e.playerId);
        switch (e.eventType) {
          case "2pt_made":
            s.pts += 2;
            s.fg2m++;
            s.fg2a++;
            break;
          case "2pt_miss":
            s.fg2a++;
            break;
          case "3pt_made":
            s.pts += 3;
            s.fg3m++;
            s.fg3a++;
            break;
          case "3pt_miss":
            s.fg3a++;
            break;
          case "ft_made":
            s.pts += 1;
            s.ftm++;
            s.fta++;
            break;
          case "ft_miss":
            s.fta++;
            break;
          case "off_reb":
            s.oreb++;
            break;
          case "def_reb":
            s.dreb++;
            break;
          case "assist":
            s.ast++;
            break;
          case "off_foul":
          case "def_foul":
          case "loose_ball_foul":
            s.pf++;
            break;
          case "turnover":
            s.to++;
            break;
          case "steal":
            s.stl++;
            break;
          case "block":
            s.blk++;
            break;
        }
      }

      // The "Assisted?" flow on made shots stores the assister on the shot
      // event itself (assist_player_id), separate from the standalone
      // "Assist" button's own event_type: "assist" rows handled above.
      if (e.assistPlayerId) {
        get(e.assistPlayerId).ast++;
      }

      const scorePoints =
        e.eventType === "2pt_made" ? 2 : e.eventType === "3pt_made" ? 3 : e.eventType === "ft_made" ? 1 : 0;
      if (scorePoints > 0 && e.teamId && onCourt[e.teamId]) {
        const otherTeam = e.teamId === homeTeamId ? visitorTeamId : homeTeamId;
        for (const pid of onCourt[e.teamId].keys()) get(pid).plusMinus += scorePoints;
        for (const pid of onCourt[otherTeam].keys()) get(pid).plusMinus -= scorePoints;
      }
    }

    // Snapshot who's still on the floor before closing them out, so the
    // next period can carry them forward (see periodStartClock above).
    const endOnCourt: Record<string, Set<string>> = {
      [homeTeamId]: new Set(onCourt[homeTeamId].keys()),
      [visitorTeamId]: new Set(onCourt[visitorTeamId].keys()),
    };

    // Players still on the floor when the period's tagged data runs out —
    // close them out at the furthest point reached (buzzer if the period is
    // fully tagged, "now" if it's still in progress).
    for (const teamId of [homeTeamId, visitorTeamId]) {
      for (const pid of [...onCourt[teamId].keys()]) {
        closeOut(teamId, pid, lastClock);
      }
    }

    carryOnCourt = endOnCourt;
  }

  return stats;
}

export function computeEff(s: PlayerBoxScore): number {
  const fga = s.fg2a + s.fg3a;
  const fgm = s.fg2m + s.fg3m;
  const reb = s.oreb + s.dreb;
  return s.pts + reb + s.ast + s.stl + s.blk - (fga - fgm) - (s.fta - s.ftm) - s.to;
}

export function fmtMin(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
