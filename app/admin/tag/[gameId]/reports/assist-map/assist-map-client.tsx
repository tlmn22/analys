"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  computeAssistMatrix,
  cellAt,
  passerTotal,
  scorerTotal,
  type AssistTypeFilter,
} from "./assist-stats";

// Heat-map shading buckets, lightest to darkest — matches the reference
// tool's orange scale (higher assist counts between the same pair stand
// out more at a glance than reading every number).
function heatClass(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "bg-orange-200/70 dark:bg-orange-900/40";
  if (count === 2) return "bg-orange-400/70 dark:bg-orange-700/60";
  return "bg-orange-600/80 text-white dark:bg-orange-600/80";
}

export function AssistMapClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeRoster,
  visitorRoster,
  rawEvents,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeRoster: RosterPlayer[];
  visitorRoster: RosterPlayer[];
  rawEvents: RawEvent[];
}) {
  const [teamId, setTeamId] = useState(homeTeamId);
  const [assistType, setAssistType] = useState<AssistTypeFilter>("all");
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  const sides = [
    { teamId: homeTeamId, teamName: homeTeamName, roster: homeRoster },
    { teamId: visitorTeamId, teamName: visitorTeamName, roster: visitorRoster },
  ];
  const side = sides.find((s) => s.teamId === teamId)!;

  function openClips(title: string, events: RawEvent[]) {
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  const matrix = useMemo(
    () => computeAssistMatrix(rawEvents, teamId, assistType),
    [rawEvents, teamId, assistType]
  );

  // Roster order, same axis both ways — matches the reference tool's
  // symmetric passer/scorer grid (every player who could pass or score,
  // not just the ones who did).
  const players = side.roster;

  function copyData() {
    const lines = [["From \\ To", ...players.map((p) => playerLabel(p)), "TOTAL"].join("\t")];
    for (const from of players) {
      const row = [playerLabel(from)];
      for (const to of players) {
        row.push(from.playerId === to.playerId ? "-" : String(cellAt(matrix, from.playerId, to.playerId).count));
      }
      row.push(String(passerTotal(matrix, from.playerId).count));
      lines.push(row.join("\t"));
    }
    const totalRow = ["TOTAL", ...players.map((p) => String(scorerTotal(matrix, p.playerId).count)), String(matrix.grandTotal.count)];
    lines.push(totalRow.join("\t"));
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Select a Team:</span>
          {sides.map((s) => (
            <label key={s.teamId} className="flex items-center gap-1">
              <input type="radio" checked={teamId === s.teamId} onChange={() => setTeamId(s.teamId)} />
              {s.teamName}
            </label>
          ))}
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Assist Type:</span>
          {(
            [
              ["all", "All Assists"],
              ["2pt", "2 Pt. Assists"],
              ["3pt", "3 Pt. Assists"],
            ] as [AssistTypeFilter, string][]
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" checked={assistType === v} onChange={() => setAssistType(v)} />
              {label}
            </label>
          ))}
        </label>
      </div>

      <h2 className="text-xl font-semibold">{side.teamName}</h2>

      <button onClick={copyData} className="flex items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
        <CopyIcon className="size-3.5" />
        Copy Data
      </button>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-border bg-muted px-3 py-2 text-left font-semibold italic">
                From Player
              </th>
              <th colSpan={players.length} className="border border-border bg-muted px-2 py-1.5 text-center font-semibold">
                Assists to Player (Scorer)
              </th>
              <th rowSpan={2} className="border border-border bg-muted px-2 py-2 text-right font-semibold">
                TOTAL
              </th>
            </tr>
            <tr>
              {players.map((p) => (
                <th key={p.playerId} className="min-w-16 border border-border bg-muted px-2 py-1.5 text-center font-semibold">
                  {playerLabel(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">
                  Roster хоосон байна.
                </td>
              </tr>
            )}
            {players.map((from) => {
              const rowTotal = passerTotal(matrix, from.playerId);
              return (
                <tr key={from.playerId}>
                  <td className="whitespace-nowrap border border-border px-3 py-1.5">{playerLabel(from)}</td>
                  {players.map((to) => {
                    if (from.playerId === to.playerId) {
                      return (
                        <td key={to.playerId} className="border border-border px-2 py-1.5 text-center text-muted-foreground">
                          -
                        </td>
                      );
                    }
                    const cell = cellAt(matrix, from.playerId, to.playerId);
                    return (
                      <td
                        key={to.playerId}
                        className={`border border-border px-2 py-1.5 text-center ${heatClass(cell.count)}`}
                      >
                        {cell.count > 0 ? (
                          <button
                            className="font-semibold text-blue-600 hover:underline dark:text-blue-300"
                            onClick={() =>
                              openClips(`${playerLabel(from)} → ${playerLabel(to)}`, cell.events)
                            }
                          >
                            {cell.count}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-border px-2 py-1.5 text-right font-semibold">
                    {rowTotal.count > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => openClips(`${playerLabel(from)} — All Assists`, rowTotal.events)}
                      >
                        {rowTotal.count}
                      </button>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              );
            })}
            {players.length > 0 && (
              <tr className="bg-muted/40 font-semibold italic">
                <td className="border border-border px-3 py-1.5">TOTAL</td>
                {players.map((to) => {
                  const colTotal = scorerTotal(matrix, to.playerId);
                  return (
                    <td key={to.playerId} className="border border-border px-2 py-1.5 text-center">
                      {colTotal.count > 0 ? (
                        <button
                          className="text-blue-500 hover:underline"
                          onClick={() => openClips(`${playerLabel(to)} — Assisted Baskets`, colTotal.events)}
                        >
                          {colTotal.count}
                        </button>
                      ) : (
                        "0"
                      )}
                    </td>
                  );
                })}
                <td className="border border-border px-2 py-1.5 text-right">
                  {matrix.grandTotal.count > 0 ? (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => openClips(`${side.teamName} — All Assists`, matrix.grandTotal.events)}
                    >
                      {matrix.grandTotal.count}
                    </button>
                  ) : (
                    "0"
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
