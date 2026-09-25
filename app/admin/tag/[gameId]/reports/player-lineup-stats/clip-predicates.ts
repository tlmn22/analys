import type { RawEvent } from "../game-summary/summary-stats";
import { computeOnCourtIntervals, type Interval } from "../game-summary/timeline-stats";

const SHOT_2_3_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);
const FT_TYPES = new Set(["ft_made", "ft_miss"]);

/** Mirrors the filtering each column in player-stats.ts already does
 * internally, but returns the matching raw events instead of a count — used
 * only for the "click a number, see the clips" drill-down. */
export function eventsForColumn(
  key: string,
  events: RawEvent[],
  teamId: string,
  playerId: string | null,
  start: number,
  end: number
): RawEvent[] {
  const inRange = events.filter((e) => e.t >= start && e.t <= end);
  const mine = inRange.filter((e) => e.teamId === teamId && (playerId ? e.playerId === playerId : true));

  switch (key) {
    case "pts":
      return mine.filter((e) => (e.points ?? 0) > 0);
    case "ast":
      return inRange.filter(
        (e) =>
          ((e.eventType === "assist" || e.eventType === "other_assist") &&
            e.teamId === teamId &&
            (playerId ? e.playerId === playerId : true)) ||
          (playerId ? e.assistPlayerId === playerId : e.teamId === teamId && !!e.assistPlayerId)
      );
    case "otherAssist":
      return mine.filter((e) => e.eventType === "other_assist");
    case "shots":
    case "efg":
      return mine.filter((e) => SHOT_2_3_TYPES.has(e.eventType));
    case "opps":
      return mine.filter((e) => SHOT_2_3_TYPES.has(e.eventType) || FT_TYPES.has(e.eventType));
    case "twoPtA":
    case "twoPtPct":
      return mine.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss");
    case "twoPtFouled":
      return mine.filter((e) => e.eventType === "2pt_made" && e.andOne);
    case "threePtA":
    case "threePtPct":
      return mine.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss");
    case "threePtFouled":
      return mine.filter((e) => e.eventType === "3pt_made" && e.andOne);
    case "ftA":
    case "ftPct":
    case "ftTrips":
    case "ftf":
      return mine.filter((e) => FT_TYPES.has(e.eventType));
    case "ts":
      return mine.filter((e) => SHOT_2_3_TYPES.has(e.eventType) || FT_TYPES.has(e.eventType));
    case "oreb":
      return mine.filter((e) => e.eventType === "off_reb");
    case "offFoul":
      return mine.filter((e) => e.eventType === "off_foul");
    case "offActionTag":
      return mine.filter((e) => e.eventType === "screen_set" || e.eventType === "screen_rcvd");
    case "to":
      return mine.filter((e) => e.eventType === "turnover");
    case "forcedTo":
      return mine.filter((e) => e.eventType === "forced_to");
    case "usage":
      return mine.filter(
        (e) => SHOT_2_3_TYPES.has(e.eventType) || FT_TYPES.has(e.eventType) || e.eventType === "turnover"
      );
    default:
      return [];
  }
}

export const CLICKABLE_COLUMNS = new Set([
  "pts",
  "ast",
  "otherAssist",
  "shots",
  "opps",
  "efg",
  "twoPtA",
  "twoPtPct",
  "twoPtFouled",
  "threePtA",
  "threePtPct",
  "threePtFouled",
  "ftA",
  "ftPct",
  "ftTrips",
  "ts",
  "ftf",
  "oreb",
  "offFoul",
  "offActionTag",
  "to",
  "forcedTo",
  "usage",
]);

function inIntervals(t: number, intervals: Interval[]): boolean {
  return intervals.some((iv) => t >= iv.start && t <= iv.end);
}

/** For the "Time" column: every event that happened while this player was
 * on the floor, split into Offense (their own team's events) / Defense
 * (the opponent's events during that same window) / All. */
export function eventsForTime(
  events: RawEvent[],
  teamId: string,
  opponentTeamId: string,
  playerId: string,
  start: number,
  end: number
): { all: RawEvent[]; offense: RawEvent[]; defense: RawEvent[] } {
  const intervals = computeOnCourtIntervals(events, playerId, teamId)
    .map((iv) => ({ start: Math.max(iv.start, start), end: Math.min(iv.end, end) }))
    .filter((iv) => iv.end > iv.start);

  const inRange = events.filter((e) => e.t >= start && e.t <= end && inIntervals(e.t, intervals));
  const offense = inRange.filter((e) => e.teamId === teamId);
  const defense = inRange.filter((e) => e.teamId === opponentTeamId);
  return { all: inRange, offense, defense };
}
