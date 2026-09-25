// Officiating error report: every Off Foul / Def Foul was tagged with a
// call-quality checkbox (OFF_FOUL_MODIFIERS in lib/tag-events.ts — Bad
// Call/Correct Call/50-50, shown for both off_foul and def_foul), so a
// "Bad Call" here is the analyst's own judgment recorded at tagging time,
// not something derived after the fact. Loose Ball Foul has no such
// checkbox and is left out — there's nothing to grade it against.

import type { RawEvent } from "../game-summary/summary-stats";

const FOUL_EVENT_TYPES = new Set(["off_foul", "def_foul"]);

export type CallQuality = "Bad Call" | "Correct Call" | "50-50" | "Unmarked";

export const CALL_QUALITIES: CallQuality[] = ["Bad Call", "Correct Call", "50-50", "Unmarked"];

export function callQuality(e: RawEvent): CallQuality {
  if (e.foulBadCall) return "Bad Call";
  if (e.foulCorrectCall) return "Correct Call";
  if (e.foulFiftyFifty) return "50-50";
  return "Unmarked";
}

export interface CallCell {
  count: number;
  events: RawEvent[];
}

function emptyCell(): CallCell {
  return { count: 0, events: [] };
}

export interface FoulTypeRow {
  key: string;
  label: string; // e.g. "Charge (Off)" / "Shooting (Def)"
  byQuality: Map<CallQuality, CallCell>;
  total: CallCell;
}

/** One row per distinct foul type tagged against `teamId` — Off Foul and
 * Def Foul combined (both share the same quality checkboxes), most-called
 * first. Row labels are built from whatever `foul_type` values actually
 * appear, so freeform "Other X" entries show up as themselves instead of
 * being lumped into a generic bucket. */
export function computeFoulCallRows(events: RawEvent[], teamId: string): FoulTypeRow[] {
  const fouls = events.filter((e) => e.teamId === teamId && FOUL_EVENT_TYPES.has(e.eventType));

  const rows = new Map<string, FoulTypeRow>();
  for (const e of fouls) {
    const sideLabel = e.eventType === "off_foul" ? "Off" : "Def";
    const typeName = e.foulType || "Other";
    const key = `${e.eventType}:${typeName}`;
    const row = rows.get(key) ?? { key, label: `${typeName} (${sideLabel})`, byQuality: new Map(), total: emptyCell() };

    const q = callQuality(e);
    const cell = row.byQuality.get(q) ?? emptyCell();
    cell.count++;
    cell.events.push(e);
    row.byQuality.set(q, cell);

    row.total.count++;
    row.total.events.push(e);

    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => b.total.count - a.total.count);
}

export function cellAt(row: FoulTypeRow, q: CallQuality): CallCell {
  return row.byQuality.get(q) ?? emptyCell();
}

export function sumRows(rows: FoulTypeRow[]): FoulTypeRow {
  const total: FoulTypeRow = { key: "TOTAL", label: "TOTAL", byQuality: new Map(), total: emptyCell() };
  for (const r of rows) {
    for (const q of CALL_QUALITIES) {
      const c = cellAt(r, q);
      if (c.count === 0) continue;
      const acc = total.byQuality.get(q) ?? emptyCell();
      acc.count += c.count;
      acc.events.push(...c.events);
      total.byQuality.set(q, acc);
    }
    total.total.count += r.total.count;
    total.total.events.push(...r.total.events);
  }
  return total;
}
