"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PERIOD_SECONDS, type RawEvent } from "../game-summary/summary-stats";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { computePlayerStats, computePossessions, type PlayerStats } from "./player-stats";
import { eventsForColumn, eventsForTime, CLICKABLE_COLUMNS } from "./clip-predicates";
import type { RosterPlayer } from "../../types";

interface ColumnDef {
  key: string;
  label: string;
  render: (s: PlayerStats, scale: number) => string;
}

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pctOr = (v: number, denom: number) => (denom > 0 ? pct(v) : "-");
const fmtCount = (v: number, scale: number) => (scale === 1 ? String(v) : (v * scale).toFixed(1));
const fmtFrac = (m: number, a: number, scale: number) =>
  scale === 1 ? `${m}/${a}` : `${(m * scale).toFixed(1)}/${(a * scale).toFixed(1)}`;

const COLUMNS: ColumnDef[] = [
  { key: "time", label: "Time", render: (s) => fmtMinSec(s.minSeconds) },
  { key: "pts", label: "Pts", render: (s, sc) => fmtCount(s.pts, sc) },
  { key: "ast", label: "Ast", render: (s, sc) => fmtCount(s.ast, sc) },
  { key: "shots", label: "Shots", render: (s, sc) => fmtCount(s.shots, sc) },
  { key: "opps", label: "Opps.", render: (s, sc) => fmtCount(s.opps, sc) },
  { key: "efg", label: "EFG%", render: (s) => pctOr(s.efgPct, s.fga2 + s.fga3) },
  { key: "twoPtA", label: "2PtA", render: (s, sc) => fmtFrac(s.fgm2, s.fga2, sc) },
  { key: "twoPtPct", label: "2Pt%", render: (s) => pctOr(s.twoPtPct, s.fga2) },
  { key: "twoPtFouled", label: "2Pt Fouled", render: (s, sc) => fmtCount(s.twoPtFouled, sc) },
  { key: "threePtA", label: "3PtA", render: (s, sc) => fmtFrac(s.fgm3, s.fga3, sc) },
  { key: "threePtPct", label: "3Pt%", render: (s) => pctOr(s.threePtPct, s.fga3) },
  { key: "threePtFouled", label: "3Pt Fouled", render: (s, sc) => fmtCount(s.threePtFouled, sc) },
  { key: "ftA", label: "FT/A", render: (s, sc) => fmtFrac(s.ftm, s.fta, sc) },
  { key: "ftPct", label: "FT%", render: (s) => pctOr(s.ftPct, s.fta) },
  { key: "ftTrips", label: "FT Trips", render: (s, sc) => fmtCount(s.ftTrips, sc) },
  { key: "ts", label: "TS%", render: (s) => pct(s.tsPct) },
  { key: "ftf", label: "FTF", render: (s) => s.ftf.toFixed(2) },
  { key: "oreb", label: "OReb", render: (s, sc) => fmtCount(s.oreb, sc) },
  { key: "offFoul", label: "Off Foul", render: (s, sc) => fmtCount(s.offFoul, sc) },
  { key: "offActionTag", label: "Off. Action Tag", render: (s, sc) => fmtCount(s.offActionTag, sc) },
  { key: "to", label: "TO", render: (s, sc) => fmtCount(s.to, sc) },
  { key: "lostTieUp", label: "Lost Tie Up", render: (s, sc) => fmtCount(s.lostTieUp, sc) },
  { key: "usage", label: "Usage %", render: (s) => (s.usagePct !== null ? pct(s.usagePct) : "-") },
  { key: "offPPP", label: "Off. PPP", render: (s) => s.offPPP.toFixed(2) },
  { key: "offPoss", label: "Off. Poss.", render: (s, sc) => fmtCount(s.offPoss, sc) },
];

interface ModalState {
  title: string;
  clips: ClipEvent[];
  offenseClips?: ClipEvent[];
  defenseClips?: ClipEvent[];
}

export function PlayerLineupStatsClient({
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
  const [range, setRange] = useState<[number, number] | null>(null);
  const [start, end] = range ?? [0, maxSeconds];
  const [perMode, setPerMode] = useState<"totals" | "per40">("totals");
  const [showMode, setShowMode] = useState<"players" | "lineups">("players");
  const [customizing, setCustomizing] = useState(false);
  const [activeCols, setActiveCols] = useState<Record<string, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true]))
  );
  const [modal, setModal] = useState<ModalState | null>(null);

  const periods: number[] = [];
  for (let p = 1; p * PERIOD_SECONDS <= maxSeconds; p++) periods.push(p);

  const possessions = useMemo(
    () => computePossessions(rawEvents, homeTeamId, visitorTeamId),
    [rawEvents, homeTeamId, visitorTeamId]
  );

  const visibleColumns = COLUMNS.filter((c) => activeCols[c.key]);

  function openClips(
    columnKey: string,
    teamId: string,
    opponentTeamId: string,
    playerId: string | null,
    playerLabel: string
  ) {
    if (columnKey === "time") {
      if (!playerId) return; // ALL row has no single on-court interval to show
      const { all, offense, defense } = eventsForTime(rawEvents, teamId, opponentTeamId, playerId, start, end);
      setModal({
        title: `${playerLabel} (Time)`,
        clips: buildClipEvents(all, homeTeamId, visitorTeamId),
        offenseClips: buildClipEvents(offense, homeTeamId, visitorTeamId),
        defenseClips: buildClipEvents(defense, homeTeamId, visitorTeamId),
      });
      return;
    }
    const matched = eventsForColumn(columnKey, rawEvents, teamId, playerId, start, end);
    const col = COLUMNS.find((c) => c.key === columnKey);
    setModal({
      title: `${playerLabel} ${col?.label ?? columnKey}`,
      clips: buildClipEvents(matched, homeTeamId, visitorTeamId),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Calculate:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={perMode === "totals"} onChange={() => setPerMode("totals")} />
            Totals
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={perMode === "per40"} onChange={() => setPerMode("per40")} />
            Per 40 Minutes
          </label>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Show:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={showMode === "players"} onChange={() => setShowMode("players")} />
            Players
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={showMode === "lineups"} onChange={() => setShowMode("lineups")} />
            Lineups
          </label>
        </label>
        <Button variant="outline" size="sm" onClick={() => setRange(null)} disabled={!range}>
          Reset
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCustomizing((c) => !c)}>
          Customize View
        </Button>
      </div>

      <div className="flex items-center gap-1 text-sm">
        {periods.map((p) => (
          <button
            key={p}
            onClick={() => setRange([(p - 1) * PERIOD_SECONDS, p * PERIOD_SECONDS])}
            className={`rounded-md px-3 py-1 ${
              range && range[0] === (p - 1) * PERIOD_SECONDS && range[1] === p * PERIOD_SECONDS
                ? "bg-blue-600 text-white"
                : "text-blue-500 hover:underline"
            }`}
          >
            Q{p}
          </button>
        ))}
        <button
          onClick={() => setRange(null)}
          className={`rounded-md px-3 py-1 ${!range ? "bg-blue-600 text-white" : "text-blue-500 hover:underline"}`}
        >
          Full Game
        </button>
        <span className="ml-2 text-muted-foreground">
          ({fmtMinSec(start)} - {fmtMinSec(end)})
        </span>
      </div>

      {customizing && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/40 p-3 text-sm">
          {COLUMNS.map((c) => (
            <label key={c.key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={activeCols[c.key]}
                onChange={() => setActiveCols((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}

      {showMode === "lineups" ? (
        <p className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Lineup combination stats — тун удахгүй нэмэгдэнэ.
        </p>
      ) : (
        <>
          <TeamTable
            teamId={homeTeamId}
            opponentTeamId={visitorTeamId}
            teamName={homeTeamName}
            roster={homeRoster}
            rawEvents={rawEvents}
            possessions={possessions}
            start={start}
            end={end}
            perMode={perMode}
            columns={visibleColumns}
            onCellClick={openClips}
          />
          <TeamTable
            teamId={visitorTeamId}
            opponentTeamId={homeTeamId}
            teamName={visitorTeamName}
            roster={visitorRoster}
            rawEvents={rawEvents}
            possessions={possessions}
            start={start}
            end={end}
            perMode={perMode}
            columns={visibleColumns}
            onCellClick={openClips}
          />
        </>
      )}

      {modal && (
        <ClipModal
          title={modal.title}
          videoUrl={videoUrl}
          clips={modal.clips}
          offenseClips={modal.offenseClips}
          defenseClips={modal.defenseClips}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function TeamTable({
  teamId,
  opponentTeamId,
  teamName,
  roster,
  rawEvents,
  possessions,
  start,
  end,
  perMode,
  columns,
  onCellClick,
}: {
  teamId: string;
  opponentTeamId: string;
  teamName: string;
  roster: RosterPlayer[];
  rawEvents: RawEvent[];
  possessions: ReturnType<typeof computePossessions>;
  start: number;
  end: number;
  perMode: "totals" | "per40";
  columns: ColumnDef[];
  onCellClick: (
    columnKey: string,
    teamId: string,
    opponentTeamId: string,
    playerId: string | null,
    playerLabel: string
  ) => void;
}) {
  const rows = roster.map((p) => ({
    player: p,
    stats: computePlayerStats(rawEvents, teamId, p.playerId, start, end, possessions),
  }));
  const allStats = computePlayerStats(rawEvents, teamId, null, start, end, possessions);

  function scaleFor(minSeconds: number) {
    if (perMode === "totals") return 1;
    return minSeconds > 0 ? 2400 / minSeconds : 0;
  }

  function isClickable(key: string) {
    return key === "time" || CLICKABLE_COLUMNS.has(key);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">{teamName}</th>
            {columns.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player, stats }) => {
            const playerLabel = `#${player.number} ${player.firstName} ${player.lastName}`;
            return (
              <tr key={player.playerId} className="border-t border-border/60">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-background px-3 py-1.5">{playerLabel}</td>
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">
                    {isClickable(c.key) ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onCellClick(c.key, teamId, opponentTeamId, player.playerId, playerLabel)}
                      >
                        {c.render(stats, scaleFor(stats.minSeconds))}
                      </button>
                    ) : (
                      c.render(stats, scaleFor(stats.minSeconds))
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="border-t-2 border-border bg-muted/40 font-semibold">
            <td className="sticky left-0 z-10 bg-muted/40 px-3 py-1.5">ALL</td>
            {columns.map((c) => (
              <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">
                {c.key !== "time" && CLICKABLE_COLUMNS.has(c.key) ? (
                  <button
                    className="text-blue-500 hover:underline"
                    onClick={() => onCellClick(c.key, teamId, opponentTeamId, null, `${teamName} — ALL`)}
                  >
                    {c.render(allStats, scaleFor(end - start))}
                  </button>
                ) : (
                  c.render(allStats, scaleFor(end - start))
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
