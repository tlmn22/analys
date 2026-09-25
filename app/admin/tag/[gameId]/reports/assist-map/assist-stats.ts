// Passer -> scorer assist matrix. The standalone "Assist"/"Other Assist"
// tags don't carry a scorer (they're just a note on the passer), so the
// only structured passer+scorer link in this taxonomy is a made shot's own
// assist_player_id (set via the "Assisted?" flow on the shot-detail panel)
// — that's what this matrix is built from.

import type { RawEvent } from "../game-summary/summary-stats";

export type AssistTypeFilter = "all" | "2pt" | "3pt";

export interface AssistCell {
  count: number;
  events: RawEvent[];
}

export interface AssistMatrixData {
  cells: Map<string, Map<string, AssistCell>>; // passerId -> scorerId -> cell
  passerTotals: Map<string, AssistCell>;
  scorerTotals: Map<string, AssistCell>;
  grandTotal: AssistCell;
}

function emptyCell(): AssistCell {
  return { count: 0, events: [] };
}

function addTo(map: Map<string, AssistCell>, key: string, e: RawEvent) {
  const cell = map.get(key) ?? emptyCell();
  cell.count++;
  cell.events.push(e);
  map.set(key, cell);
}

export function computeAssistMatrix(
  events: RawEvent[],
  teamId: string,
  assistType: AssistTypeFilter
): AssistMatrixData {
  const assistedShots = events.filter(
    (e) =>
      e.teamId === teamId &&
      e.assistPlayerId &&
      e.playerId &&
      (e.eventType === "2pt_made" || e.eventType === "3pt_made") &&
      (assistType === "all" ||
        (assistType === "2pt" && e.eventType === "2pt_made") ||
        (assistType === "3pt" && e.eventType === "3pt_made"))
  );

  const cells = new Map<string, Map<string, AssistCell>>();
  const passerTotals = new Map<string, AssistCell>();
  const scorerTotals = new Map<string, AssistCell>();
  const grandTotal = emptyCell();

  for (const e of assistedShots) {
    const passer = e.assistPlayerId!;
    const scorer = e.playerId!;

    let row = cells.get(passer);
    if (!row) {
      row = new Map();
      cells.set(passer, row);
    }
    addTo(row, scorer, e);

    addTo(passerTotals, passer, e);
    addTo(scorerTotals, scorer, e);

    grandTotal.count++;
    grandTotal.events.push(e);
  }

  return { cells, passerTotals, scorerTotals, grandTotal };
}

export function cellAt(data: AssistMatrixData, passerId: string, scorerId: string): AssistCell {
  return data.cells.get(passerId)?.get(scorerId) ?? emptyCell();
}

export function passerTotal(data: AssistMatrixData, passerId: string): AssistCell {
  return data.passerTotals.get(passerId) ?? emptyCell();
}

export function scorerTotal(data: AssistMatrixData, scorerId: string): AssistCell {
  return data.scorerTotals.get(scorerId) ?? emptyCell();
}
