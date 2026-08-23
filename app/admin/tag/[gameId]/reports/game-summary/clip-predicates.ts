import type { RawEvent } from "./summary-stats";
import { shotDistance, RIM_RADIUS, SHORT_MID_RADIUS } from "./shooting-stats";

const SHOT_2_3_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);
const FT_TYPES = new Set(["ft_made", "ft_miss"]);

/** Team-level mirror of player-lineup-stats/clip-predicates.ts — used for
 * the "click a Comparison/Shooting number, see the clips" drill-down on
 * this report's team-vs-team tables (no player filter). */
export function eventsForTeamColumn(
  key: string,
  events: RawEvent[],
  teamId: string,
  start: number,
  end: number
): RawEvent[] {
  const mine = events.filter((e) => e.teamId === teamId && e.t >= start && e.t <= end);
  switch (key) {
    case "points":
      return mine.filter((e) => (e.points ?? 0) > 0);
    case "timeouts":
      return mine.filter((e) => e.eventType === "timeout");
    case "turnovers":
      return mine.filter((e) => e.eventType === "turnover");
    case "oreb":
      return mine.filter((e) => e.eventType === "off_reb");
    case "dreb":
      return mine.filter((e) => e.eventType === "def_reb");
    case "twoPt":
      return mine.filter((e) => e.eventType === "2pt_made" || e.eventType === "2pt_miss");
    case "threePt":
      return mine.filter((e) => e.eventType === "3pt_made" || e.eventType === "3pt_miss");
    case "ft":
      return mine.filter((e) => FT_TYPES.has(e.eventType));
    case "shots":
      return mine.filter((e) => SHOT_2_3_TYPES.has(e.eventType));
    case "atRim":
    case "shortMid":
    case "longMid": {
      const twoPt = mine.filter(
        (e) => (e.eventType === "2pt_made" || e.eventType === "2pt_miss") && e.shotX !== null && e.shotY !== null
      );
      return twoPt.filter((e) => {
        const d = shotDistance(e.shotX as number, e.shotY as number);
        if (key === "atRim") return d <= RIM_RADIUS;
        if (key === "shortMid") return d > RIM_RADIUS && d <= SHORT_MID_RADIUS;
        return d > SHORT_MID_RADIUS;
      });
    }
    default:
      return [];
  }
}
