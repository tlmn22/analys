"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  buildColumns,
  computeShotAnalysisRows,
  eventsForCell,
  type ShotRange,
  type ShotResult,
  type CellStat,
} from "./shot-analysis-stats";

type ViewMode = "pct" | "count";

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function cellText(stat: CellStat, view: ViewMode): string {
  if (stat.attempts === 0) return "-";
  if (view === "count") return `${stat.makes}/${stat.attempts}`;
  const pct = ((stat.makes / stat.attempts) * 100).toFixed(1);
  return `${stat.makes}/${stat.attempts}\n${pct}%`;
}

function TimeRangeSlider({
  value,
  max,
  onChange,
}: {
  value: [number, number];
  max: number;
  onChange: (v: [number, number]) => void;
}) {
  const [min, mx] = value;
  return (
    <div>
      <div className="relative h-6">
        <input
          type="range"
          min={0}
          max={max}
          value={min}
          onChange={(e) => onChange([Math.min(Number(e.target.value), mx), mx])}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={0}
          max={max}
          value={mx}
          onChange={(e) => onChange([min, Math.max(Number(e.target.value), min)])}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-muted-foreground">
        <span className="absolute left-0">H1</span>
        <span className="absolute" style={{ left: "50%", transform: "translateX(-50%)" }}>
          H2
        </span>
      </div>
    </div>
  );
}

export function ShotAnalysisClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeRoster,
  visitorRoster,
  rawEvents,
  maxSeconds,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeRoster: RosterPlayer[];
  visitorRoster: RosterPlayer[];
  rawEvents: RawEvent[];
  maxSeconds: number;
}) {
  const [teamId, setTeamId] = useState(homeTeamId);
  const [range, setRange] = useState<ShotRange>("2pt");
  const [result, setResult] = useState<ShotResult>("all");
  const [view, setView] = useState<ViewMode>("pct");
  const [excludeFouled] = useState(true);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, maxSeconds]);
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  const roster = teamId === homeTeamId ? homeRoster : visitorRoster;
  const rosterById = useMemo(() => new Map(roster.map((p) => [p.playerId, p])), [roster]);
  const playedIds = useMemo(
    () => roster.filter((p) => rawEvents.some((e) => e.teamId === teamId && e.playerId === p.playerId)).map((p) => p.playerId),
    [roster, rawEvents, teamId]
  );

  const columns = useMemo(() => buildColumns(range), [range]);
  const [start, end] = timeRange;

  const rows = useMemo(
    () => computeShotAnalysisRows(rawEvents, teamId, playedIds, range, result, start, end, excludeFouled),
    [rawEvents, teamId, playedIds, range, result, start, end, excludeFouled]
  );

  function openCellClips(title: string, playerId: string | null, columnKey: string | null | "total") {
    const events = eventsForCell(rawEvents, teamId, playerId, range, result, start, end, excludeFouled, columnKey);
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  function copyData() {
    const header = ["Player", ...columns.map((c) => c.label), "(uncategorized)", "All"];
    const lines = [header.join("\t")];
    for (const row of rows) {
      const name = row.playerId ? playerLabel(rosterById.get(row.playerId)!) : "ALL";
      const cells = [
        ...columns.map((c) => cellText(row.byColumn.get(c.key) ?? { makes: 0, attempts: 0 }, view).replace("\n", " ")),
        cellText(row.uncategorized, view).replace("\n", " "),
        cellText(row.total, view).replace("\n", " "),
      ];
      lines.push([name, ...cells].join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-1.5">
          Team:
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded border border-border bg-background px-1 py-0.5"
          >
            <option value={homeTeamId}>{homeTeamName}</option>
            <option value={visitorTeamId}>{visitorTeamName}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Range:
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as ShotRange)}
            className="rounded border border-border bg-background px-1 py-0.5"
          >
            <option value="all">All Shots</option>
            <option value="2pt">2 Pt. Shots</option>
            <option value="3pt">3 Pt. Shots</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Result:
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as ShotResult)}
            className="rounded border border-border bg-background px-1 py-0.5"
          >
            <option value="all">All Attempts</option>
            <option value="made">Made</option>
            <option value="missed">Missed</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Segment:
          <select value="shot_types" disabled className="rounded border border-border bg-background px-1 py-0.5">
            <option value="shot_types">Shot Types</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          View:
          <select
            value={view}
            onChange={(e) => setView(e.target.value as ViewMode)}
            className="rounded border border-border bg-background px-1 py-0.5"
          >
            <option value="pct">Percentage</option>
            <option value="count">Makes/Attempts</option>
          </select>
        </label>
      </div>

      <div className="max-w-xl">
        <TimeRangeSlider value={timeRange} max={maxSeconds} onChange={setTimeRange} />
        <p className="mt-1 text-xs text-muted-foreground">
          {fmtClock(start)} - {fmtClock(end)}
        </p>
      </div>

      <button onClick={copyData} className="flex w-fit items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
        <CopyIcon className="size-3.5" />
        Copy Data
      </button>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Player</th>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-2 text-center font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">(uncategorized)</th>
              <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">All</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const name = row.playerId ? playerLabel(rosterById.get(row.playerId)!) : "ALL";
              return (
                <tr
                  key={row.playerId ?? "ALL"}
                  className={`border-t border-border/60 ${row.playerId === null ? "bg-muted/40 font-semibold" : ""}`}
                >
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  {columns.map((c) => {
                    const stat = row.byColumn.get(c.key) ?? { makes: 0, attempts: 0 };
                    return (
                      <td key={c.key} className="whitespace-pre-line px-2 py-1.5 text-center">
                        {stat.attempts > 0 ? (
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => openCellClips(`${name} — ${c.label}`, row.playerId, c.key)}
                          >
                            {cellText(stat, view)}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-pre-line px-2 py-1.5 text-center">
                    {row.uncategorized.attempts > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => openCellClips(`${name} — (uncategorized)`, row.playerId, null)}
                      >
                        {cellText(row.uncategorized, view)}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-pre-line px-2 py-1.5 text-center font-semibold">
                    {row.total.attempts > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => openCellClips(`${name} — All`, row.playerId, "total")}
                      >
                        {cellText(row.total, view)}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Note: Percentages don&apos;t include and-1 fouled makes.</p>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
