import type { RawEvent } from "./summary-stats";

export interface Interval {
  start: number;
  end: number;
}

/** Reconstructs one player's on-court intervals across the whole game from
 * lineup_set/sub_in/sub_out events — same ascending-period + carry-forward
 * logic as the box score's MIN calculation (boxscore/stats.ts), kept as its
 * own copy here since this report needs the raw interval list rather than
 * a summed total. */
export function computeOnCourtIntervals(events: RawEvent[], playerId: string, teamId: string): Interval[] {
  const periodsSet = new Set<number>();
  for (const e of events) periodsSet.add(e.period);
  const periodNumbers = [...periodsSet].sort((a, b) => a - b);

  const intervals: Interval[] = [];
  let carryOnCourt = false;

  for (const period of periodNumbers) {
    const periodEvents = events.filter((e) => e.period === period).sort((a, b) => a.t - b.t);
    if (!periodEvents.length) continue;

    const periodStart = periodEvents[0].t;
    const periodEnd = periodEvents[periodEvents.length - 1].t;
    let onCourtSince: number | null = carryOnCourt ? periodStart : null;

    for (const e of periodEvents) {
      if (e.teamId !== teamId || e.playerId !== playerId) continue;
      if (e.eventType === "lineup_set" || e.eventType === "sub_in") {
        onCourtSince = e.t;
      } else if (e.eventType === "sub_out" && onCourtSince !== null) {
        intervals.push({ start: onCourtSince, end: e.t });
        onCourtSince = null;
      }
    }

    if (onCourtSince !== null) {
      intervals.push({ start: onCourtSince, end: periodEnd });
      carryOnCourt = true;
    } else {
      carryOnCourt = false;
    }
  }

  return intervals;
}

export interface TimelineMark {
  t: number;
  color: string;
  radius: number;
  tick?: boolean;
  label: string;
}

export interface TimelineRowMarks {
  shots: TimelineMark[];
  turnovers: TimelineMark[];
  rebounds: TimelineMark[];
  fouls: TimelineMark[];
  assists: TimelineMark[];
  steals: TimelineMark[];
  plusMinus: TimelineMark[];
}

const MADE_COLOR = "#16a34a";
const MISS_COLOR = "#dc2626";
const OREB_COLOR = "#3b82f6";
const DREB_COLOR = "#475569";
const OFF_FOUL_COLOR = "#f97316";
const DEF_FOUL_COLOR = "#eab308";
const ASSIST_COLOR = "#4d7c0f";
const STEAL_COLOR = "#ea580c";
const TURNOVER_COLOR = "#dc2626";

const SHOT_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss", "ft_made", "ft_miss"]);
const SCORE_TYPES = new Set(["2pt_made", "3pt_made", "ft_made"]);

function shotRadius(eventType: string): number {
  if (eventType.startsWith("3pt")) return 8;
  if (eventType.startsWith("ft")) return 4;
  return 6;
}

function inIntervals(t: number, intervals: Interval[] | null): boolean {
  if (!intervals) return true; // team-level rows: always "on the floor"
  return intervals.some((iv) => t >= iv.start && t <= iv.end);
}

/** Builds every category's mark list for one row — either a whole team
 * (pass `playerId: undefined`, `onCourtIntervals: null`) or a single player
 * (pass their id + their on-court intervals, so off-court time is
 * excluded from the marks even if the raw event happened elsewhere on the
 * floor while they sat). */
export function computeTimelineMarks(
  events: RawEvent[],
  teamId: string,
  playerId: string | undefined,
  onCourtIntervals: Interval[] | null
): TimelineRowMarks {
  const mine = (e: RawEvent) => (playerId ? e.playerId === playerId : e.teamId === teamId);

  const shots: TimelineMark[] = events
    .filter((e) => mine(e) && SHOT_TYPES.has(e.eventType))
    .map((e) => ({
      t: e.t,
      color: e.eventType.endsWith("_made") ? MADE_COLOR : MISS_COLOR,
      radius: shotRadius(e.eventType),
      label: `${e.eventType}${e.shotType ? ` (${e.shotType})` : ""}`,
    }));

  const turnovers: TimelineMark[] = events
    .filter((e) => mine(e) && e.eventType === "turnover")
    .map((e) => ({ t: e.t, color: TURNOVER_COLOR, radius: 0, tick: true, label: "Turnover" }));

  const rebounds: TimelineMark[] = events
    .filter((e) => mine(e) && (e.eventType === "off_reb" || e.eventType === "def_reb"))
    .map((e) => ({
      t: e.t,
      color: e.eventType === "off_reb" ? OREB_COLOR : DREB_COLOR,
      radius: 4,
      label: e.eventType === "off_reb" ? "Off Reb" : "Def Reb",
    }));

  const fouls: TimelineMark[] = events
    .filter((e) => mine(e) && (e.eventType === "off_foul" || e.eventType === "def_foul" || e.eventType === "loose_ball_foul"))
    .map((e) => ({
      t: e.t,
      color: e.eventType === "off_foul" ? OFF_FOUL_COLOR : DEF_FOUL_COLOR,
      radius: 0,
      tick: true,
      label: e.eventType,
    }));

  const assists: TimelineMark[] = [];
  for (const e of events) {
    const isAssistEvent = (e.eventType === "assist" || e.eventType === "other_assist") && mine(e);
    const isCreditedAssist = e.assistPlayerId
      ? playerId
        ? e.assistPlayerId === playerId
        : e.teamId === teamId
      : false;
    if (isAssistEvent || isCreditedAssist) {
      assists.push({ t: e.t, color: ASSIST_COLOR, radius: 0, tick: true, label: "Assist" });
    }
  }

  const steals: TimelineMark[] = events
    .filter((e) => mine(e) && e.eventType === "steal")
    .map((e) => ({ t: e.t, color: STEAL_COLOR, radius: 0, tick: true, label: "Steal" }));

  const plusMinus: TimelineMark[] = events
    .filter((e) => SCORE_TYPES.has(e.eventType) && e.teamId && inIntervals(e.t, onCourtIntervals))
    .map((e) => ({
      t: e.t,
      color: e.teamId === teamId ? MADE_COLOR : MISS_COLOR,
      radius: 0,
      tick: true,
      label: `${e.teamId === teamId ? "+" : "-"}${e.points}`,
    }));

  return { shots, turnovers, rebounds, fouls, assists, steals, plusMinus };
}
