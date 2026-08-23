import type { RawEvent } from "./game-summary/summary-stats";

export interface ClipEvent {
  id: string;
  videoTime: number;
  t: number;
  period: number;
  clockLabel: string;
  scoreLabel: string;
  label: string;
  badgeColor: string;
}

const EVENT_LABELS: Record<string, string> = {
  "2pt_made": "2Pt",
  "2pt_miss": "2Pt miss",
  "3pt_made": "3Pt",
  "3pt_miss": "3Pt miss",
  ft_made: "FT",
  ft_miss: "FT miss",
  off_reb: "Off Reb",
  def_reb: "Def Reb",
  turnover: "TO",
  assist: "Assist",
  other_assist: "Other Assist",
  steal: "Steal",
  block: "Block",
  off_foul: "Off Foul",
  def_foul: "Def Foul",
  loose_ball_foul: "Loose Ball Foul",
  tie_up: "Tie Up",
  take_charge: "Take Charge",
  forced_to: "Forced TO",
  deflect: "Deflect",
  timeout: "Time Out",
  sub_in: "Sub In",
  sub_out: "Sub Out",
  lineup_set: "Starter",
  end_quarter: "End Quarter",
  screen_set: "Screen Set",
  screen_rcvd: "Screen Rcvd.",
  physical_contact: "Physical Contact",
  hustle_play: "Hustle Play",
};

const BADGE_COLORS: Record<string, string> = {
  "2pt_made": "#16a34a",
  "3pt_made": "#16a34a",
  ft_made: "#16a34a",
  "2pt_miss": "#f97316",
  "3pt_miss": "#f97316",
  ft_miss: "#f97316",
  turnover: "#dc2626",
  off_foul: "#111827",
  def_foul: "#111827",
  loose_ball_foul: "#111827",
  off_reb: "#3b82f6",
  def_reb: "#475569",
  assist: "#4d7c0f",
  other_assist: "#4d7c0f",
  steal: "#ea580c",
  block: "#2563eb",
  tie_up: "#111827",
  timeout: "#2563eb",
};

const PERIOD_SECONDS = 600;

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function clipLabel(e: RawEvent): string {
  const base = EVENT_LABELS[e.eventType] ?? e.eventType;
  if (e.shotType && e.eventType.includes("pt")) return `${base}: ${e.shotType}`;
  return base;
}

/** Turns a raw event list into video-clip entries — one per event, in
 * chronological order, each carrying the score just BEFORE that event (so
 * "Q1 (0-0) ... 3PT" reads as "the score was 0-0 right before this shot"). */
export function buildClipEvents(events: RawEvent[], homeTeamId: string, visitorTeamId: string): ClipEvent[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  let h = 0;
  let v = 0;
  return sorted.map((e) => {
    const scoreLabel = `(${h}-${v})`;
    if (e.teamId === homeTeamId) h += e.points ?? 0;
    else if (e.teamId === visitorTeamId) v += e.points ?? 0;
    const periodElapsed = e.t - (e.period - 1) * PERIOD_SECONDS;
    return {
      id: e.id,
      videoTime: e.videoTime,
      t: e.t,
      period: e.period,
      clockLabel: fmtClock(PERIOD_SECONDS - periodElapsed),
      scoreLabel,
      label: clipLabel(e),
      badgeColor: BADGE_COLORS[e.eventType] ?? "#6b7280",
    };
  });
}
