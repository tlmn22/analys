"use client";

import { useMemo, useState } from "react";
import { CopyIcon, VideoIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { combinations } from "./interval-ops";
import { computeComboRow, didPlay, type ComboRow, type DerivedMetrics } from "./impact-stats";

type ViewMode = "net" | "on" | "off";
type ComboSize = 1 | 2 | 3 | 4 | 5;

interface Column {
  key: string;
  label: string;
  get: (m: DerivedMetrics) => number | null;
  pct: boolean;
  /** Shown as a hover tooltip on the column header — how the number is
   * calculated, in NET mode read as "(value while ON) − (value while OFF)". */
  title: string;
}

const POSS_NOTE = "Poss. estimated as FGA + 0.44×FTA + TO − OREB (Hollinger estimate).";

const COLUMNS: Column[] = [
  { key: "efg", label: "EFG %", get: (m) => m.efgPct, pct: true, title: "(FGM + 0.5 × 3PM) / FGA" },
  { key: "2pt", label: "2 Pt. %", get: (m) => m.twoPtPct, pct: true, title: "2PM / 2PA" },
  { key: "3pt", label: "3 Pt. %", get: (m) => m.threePtPct, pct: true, title: "3PM / 3PA" },
  { key: "ftf", label: "FTF", get: (m) => m.ftRate, pct: false, title: "Free Throw Rate = FTA / FGA" },
  { key: "astto", label: "A/TO", get: (m) => m.astToRatio, pct: false, title: "Assists / Turnovers" },
  { key: "to", label: "TO %", get: (m) => m.tovPct, pct: true, title: `Turnovers / Possessions. ${POSS_NOTE}` },
  {
    key: "oreb",
    label: "OReb %",
    get: (m) => m.orebPct,
    pct: true,
    title: "Off. Rebounds / (Off. Rebounds + Opponent Def. Rebounds)",
  },
  {
    key: "dreb",
    label: "DReb %",
    get: (m) => m.drebPct,
    pct: true,
    title: "Def. Rebounds / (Def. Rebounds + Opponent Off. Rebounds)",
  },
  {
    key: "reb",
    label: "Reb %",
    get: (m) => m.rebPct,
    pct: true,
    title: "(Off. + Def. Rebounds) / (all rebounds available to both teams)",
  },
  {
    key: "deftov",
    label: "Def TO %",
    get: (m) => m.defTovPct,
    pct: true,
    title: `Opponent's Turnovers / Opponent's Possessions — how often the defense forces a turnover. ${POSS_NOTE}`,
  },
  {
    key: "def2pt",
    label: "Def 2Pt %",
    get: (m) => m.defTwoPtPct,
    pct: true,
    title: "Opponent 2PM / 2PA — 2-point % allowed on defense",
  },
  {
    key: "def3pt",
    label: "Def 3Pt %",
    get: (m) => m.defThreePtPct,
    pct: true,
    title: "Opponent 3PM / 3PA — 3-point % allowed on defense",
  },
  {
    key: "stl",
    label: "Stl %",
    get: (m) => m.stlPct,
    pct: false,
    title: `Steals / Opponent's Possessions. ${POSS_NOTE}`,
  },
  { key: "plusminus", label: "+/-", get: (m) => m.plusMinus, pct: false, title: "Team Points − Opponent Points" },
  {
    key: "offppp",
    label: "Off PPP",
    get: (m) => m.offPPP,
    pct: false,
    title: `Points Per Possession = Team Points / Possessions. ${POSS_NOTE}`,
  },
  {
    key: "defppp",
    label: "Def PPP",
    get: (m) => m.defPPP,
    pct: false,
    title: `Opponent Points / Opponent Possessions. ${POSS_NOTE}`,
  },
  { key: "netppp", label: "Net PPP", get: (m) => m.netPPP, pct: false, title: "Off PPP − Def PPP" },
  { key: "pace", label: "Pace", get: (m) => m.pace, pct: false, title: "Average of Off Pace and Def Pace" },
  {
    key: "offpace",
    label: "Off Pace",
    get: (m) => m.offPace,
    pct: false,
    title: `Team Possessions scaled to a per-40-minute rate. ${POSS_NOTE}`,
  },
  {
    key: "defpace",
    label: "Def Pace",
    get: (m) => m.defPace,
    pct: false,
    title: `Opponent Possessions scaled to a per-40-minute rate. ${POSS_NOTE}`,
  },
];

const HIDE_OPTIONS = [
  { label: "Show All", seconds: 0 },
  { label: "30 sec", seconds: 30 },
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtPct(v: number, signed: boolean): string {
  const p = v * 100;
  const s = p.toFixed(2);
  return signed && p >= 0 ? `+${s}%` : `${s}%`;
}

function fmtNum(v: number, signed: boolean): string {
  const s = v.toFixed(2);
  return signed && v >= 0 ? `+${s}` : s;
}

/** Reads a column for the active view: raw ON value, raw OFF value, or the
 * NET (ON minus OFF) difference — null propagates as "no data" (e.g. A/TO
 * with zero turnovers on one side). */
function cellValue(col: Column, row: ComboRow, mode: ViewMode): number | null {
  if (mode === "on") return col.get(row.on);
  if (mode === "off") return col.get(row.off);
  const a = col.get(row.on);
  const b = col.get(row.off);
  return a === null || b === null ? null : a - b;
}

function cellText(col: Column, value: number, mode: ViewMode): string {
  return col.pct ? fmtPct(value, mode === "net") : fmtNum(value, mode === "net");
}

export function PlayerImpactClient({
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
  const [mode, setMode] = useState<ViewMode>("net");
  const [comboSize, setComboSize] = useState<ComboSize>(1);
  const [hideBelow, setHideBelow] = useState(0);
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[]; offense: ClipEvent[]; defense: ClipEvent[] } | null>(
    null
  );

  const opponentTeamId = teamId === homeTeamId ? visitorTeamId : homeTeamId;
  const roster = teamId === homeTeamId ? homeRoster : visitorRoster;
  const rosterById = useMemo(() => new Map(roster.map((p) => [p.playerId, p])), [roster]);

  const playedRoster = useMemo(
    () => roster.filter((p) => didPlay(rawEvents, teamId, p.playerId)),
    [roster, rawEvents, teamId]
  );

  const rows = useMemo(() => {
    const combos = combinations(playedRoster, comboSize);
    return combos.map((combo) =>
      computeComboRow(
        rawEvents,
        teamId,
        opponentTeamId,
        combo.map((p) => p.playerId),
        0,
        maxSeconds
      )
    );
  }, [playedRoster, comboSize, rawEvents, teamId, opponentTeamId, maxSeconds]);

  // A combo that never shared the floor at all (0:00) has no meaningful
  // stats to show — always hidden, regardless of the play-time filter.
  const visibleRows = rows.filter((r) => r.onSeconds > 0 && r.onSeconds >= hideBelow);

  const SIZE_LABELS: Record<ComboSize, string> = {
    1: "Individuals",
    2: "Pairs",
    3: "Trios",
    4: "Groups of 4",
    5: "Groups of 5",
  };
  const sizeLabel = SIZE_LABELS[comboSize];
  const modeLabel =
    mode === "net" ? "NET (ON minus OFF)" : mode === "on" ? "ON the floor" : "OFF the floor";

  function copyData() {
    const lines = [["Player(s)", "Time", ...COLUMNS.map((c) => c.label)].join("\t")];
    for (const row of visibleRows) {
      const names = row.playerIds.map((id) => rosterById.get(id)).filter((p): p is RosterPlayer => !!p);
      const cells = COLUMNS.map((c) => {
        const v = cellValue(c, row, mode);
        return v === null ? "-" : cellText(c, v, mode);
      });
      lines.push([names.map(playerLabel).join(", "), fmtMinSec(row.onSeconds), ...cells].join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  function openTimeClips(row: ComboRow) {
    const inWindow = rawEvents.filter((e) =>
      row.onIntervals.some((iv) => e.t >= iv.start && e.t < iv.end)
    );
    const names = row.playerIds.map((id) => rosterById.get(id)).filter((p): p is RosterPlayer => !!p);
    setModal({
      title: `${names.map(playerLabel).join(", ")} — Time on Floor Together`,
      clips: buildClipEvents(inWindow, homeTeamId, visitorTeamId),
      offense: buildClipEvents(
        inWindow.filter((e) => e.teamId === teamId),
        homeTeamId,
        visitorTeamId
      ),
      defense: buildClipEvents(
        inWindow.filter((e) => e.teamId === opponentTeamId),
        homeTeamId,
        visitorTeamId
      ),
    });
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="mb-1 font-semibold">Select a team:</div>
        <div className="flex gap-4">
          {[
            { id: homeTeamId, name: homeTeamName },
            { id: visitorTeamId, name: visitorTeamName },
          ].map((t) => (
            <label key={t.id} className="flex items-center gap-1.5">
              <input type="radio" checked={teamId === t.id} onChange={() => setTeamId(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {(
          [
            ["net", "NET (ON minus OFF)"],
            ["on", "ON the floor"],
            ["off", "OFF the floor"],
          ] as [ViewMode, string][]
        ).map(([m, label]) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
            {label}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setComboSize(1)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            comboSize === 1 ? "bg-blue-600" : "bg-blue-600/50"
          }`}
        >
          All Individuals
        </button>
        <button
          onClick={() => setComboSize(2)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            comboSize === 2 ? "bg-orange-600" : "bg-orange-600/50"
          }`}
        >
          All Groups of 2
        </button>
        <button
          onClick={() => setComboSize(3)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            comboSize === 3 ? "bg-green-700" : "bg-green-700/50"
          }`}
        >
          All Groups of 3
        </button>
        <button
          onClick={() => setComboSize(4)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            comboSize === 4 ? "bg-purple-700" : "bg-purple-700/50"
          }`}
        >
          All Groups of 4
        </button>
        <button
          onClick={() => setComboSize(5)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            comboSize === 5 ? "bg-rose-700" : "bg-rose-700/50"
          }`}
        >
          All Groups of 5
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          Player Impact for up to {rows.length} Player {sizeLabel}: {modeLabel}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Hide Play Time less than:
          <select
            value={hideBelow}
            onChange={(e) => setHideBelow(Number(e.target.value))}
            className="rounded border border-border bg-background px-1 py-0.5"
          >
            {HIDE_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button onClick={copyData} className="flex w-fit items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
        <CopyIcon className="size-3.5" />
        Copy Data
      </button>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Player(s)</th>
              <th
                className="whitespace-nowrap px-2 py-2 text-right font-semibold"
                title="Total time this combo shared the floor together this game."
              >
                Time
              </th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="cursor-help whitespace-nowrap px-2 py-2 text-right font-semibold underline decoration-dotted"
                  title={
                    mode === "net"
                      ? `${c.title}\n\nNET mode: (value while ON) − (value while OFF).`
                      : c.title
                  }
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const names = row.playerIds
                .map((id) => rosterById.get(id))
                .filter((p): p is RosterPlayer => !!p);
              return (
                <tr key={row.playerIds.join(",")} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{names.map(playerLabel).join(", ")}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button
                      onClick={() => openTimeClips(row)}
                      className="inline-flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      <VideoIcon className="size-3" />
                      {fmtMinSec(row.onSeconds)}
                    </button>
                  </td>
                  {COLUMNS.map((c) => {
                    const v = cellValue(c, row, mode);
                    return (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-2 py-1.5 text-right ${
                          v === null ? "" : v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {v === null ? "-" : cellText(c, v, mode)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={2 + COLUMNS.length} className="px-3 py-4 text-center text-muted-foreground">
                  Тоглосон тоглогч олдсонгүй.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ClipModal
          title={modal.title}
          videoUrl={videoUrl}
          clips={modal.clips}
          offenseClips={modal.offense}
          defenseClips={modal.defense}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
