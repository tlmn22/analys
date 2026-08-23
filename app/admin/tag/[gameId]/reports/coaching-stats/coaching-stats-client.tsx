"use client";

import { useState } from "react";
import { CopyIcon } from "lucide-react";
import { PERIOD_SECONDS, type RawEvent } from "../game-summary/summary-stats";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  computeSetCategoryTotals,
  sumTotals,
  OFFENSE_ROW_LABELS,
  DEFENSE_ROW_LABELS,
  type CategoryTotals,
  type CategoryEvents,
} from "./coaching-stats";

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pctOr = (m: number, a: number) => (a > 0 ? pct(m / a) : "-");
const numOr = (v: number, denom: number, digits = 2) => (denom > 0 ? v.toFixed(digits) : "-");

interface Column {
  key: string;
  label: string;
  render: (t: CategoryTotals, scale: number) => string;
  /** Which of the row's per-category event lists this column's drill-down
   * clip modal should show — keeps "Sets" showing only the set-tag calls,
   * "Points" only the makes, etc., instead of one shared undifferentiated
   * list. */
  events: (e: CategoryEvents) => RawEvent[];
}

function scaleCount(v: number, scale: number): string {
  return scale === 1 ? String(v) : (v * scale).toFixed(1);
}

const COLUMNS: Column[] = [
  { key: "sets", label: "Sets", render: (t, sc) => scaleCount(t.sets, sc), events: (e) => e.setTag },
  { key: "points", label: "Points", render: (t, sc) => scaleCount(t.points, sc), events: (e) => e.scoring },
  {
    key: "pps",
    label: "Points Per Set Outcome",
    render: (t) => numOr(t.points, t.sets - t.noOutcomeSets),
    events: (e) => e.scoring,
  },
  { key: "2pt", label: "2 Pt.", render: (t) => `${t.fgm2}/${t.fga2}`, events: (e) => e.twoPt },
  { key: "2pt%", label: "2 Pt. %", render: (t) => pctOr(t.fgm2, t.fga2), events: (e) => e.twoPt },
  {
    key: "2ptmiss",
    label: "2 Pt. Missed",
    render: (t, sc) => scaleCount(t.fga2 - t.fgm2, sc),
    events: (e) => e.twoPt.filter((ev) => ev.eventType === "2pt_miss"),
  },
  { key: "3pt", label: "3 Pt.", render: (t) => `${t.fgm3}/${t.fga3}`, events: (e) => e.threePt },
  { key: "3pt%", label: "3 Pt. %", render: (t) => pctOr(t.fgm3, t.fga3), events: (e) => e.threePt },
  {
    key: "3ptmiss",
    label: "3 Pt. Missed",
    render: (t, sc) => scaleCount(t.fga3 - t.fgm3, sc),
    events: (e) => e.threePt.filter((ev) => ev.eventType === "3pt_miss"),
  },
  {
    key: "efg",
    label: "EFG %",
    render: (t) => pctOr(t.fgm2 + t.fgm3 + 0.5 * t.fgm3, t.fga2 + t.fga3),
    events: (e) => [...e.twoPt, ...e.threePt],
  },
  { key: "oreb", label: "OREBs", render: (t, sc) => scaleCount(t.oreb, sc), events: (e) => e.oreb },
  {
    key: "orebrate",
    label: "OReb Rate",
    render: (t) => pctOr(t.oreb, t.fga2 - t.fgm2 + (t.fga3 - t.fgm3)),
    events: (e) => e.oreb,
  },
  { key: "fttrips", label: "FT Trips", render: (t, sc) => scaleCount(t.ftTrips, sc), events: (e) => e.ft },
  { key: "to", label: "TO", render: (t, sc) => scaleCount(t.to, sc), events: (e) => e.to },
  { key: "deffoul", label: "Def Foul", render: (t, sc) => scaleCount(t.defFoul, sc), events: (e) => e.defFoul },
  { key: "and1", label: "And 1", render: (t, sc) => scaleCount(t.andOne, sc), events: (e) => e.andOne },
  {
    key: "nooutcome",
    label: "no outcome",
    render: (t, sc) => scaleCount(t.noOutcomeSets, sc),
    events: (e) => e.noOutcome,
  },
];

export function CoachingStatsClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  rawEvents,
  maxSeconds,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  rawEvents: RawEvent[];
  maxSeconds: number;
}) {
  const [range, setRange] = useState<[number, number] | null>(null);
  const [start, end] = range ?? [0, maxSeconds];
  const [perMode, setPerMode] = useState<"totals" | "per100">("totals");
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  const periods: number[] = [];
  for (let p = 1; p * PERIOD_SECONDS <= maxSeconds; p++) periods.push(p);

  function openClips(title: string, events: RawEvent[]) {
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  const tables: { title: string; rowLabels: Record<string, string>; totals: CategoryTotals[] }[] = [
    {
      title: `${homeTeamName} Offensive Sets`,
      rowLabels: OFFENSE_ROW_LABELS,
      totals: computeSetCategoryTotals(rawEvents, homeTeamId, visitorTeamId, "offense", start, end),
    },
    {
      title: `${visitorTeamName} Offensive Sets`,
      rowLabels: OFFENSE_ROW_LABELS,
      totals: computeSetCategoryTotals(rawEvents, visitorTeamId, homeTeamId, "offense", start, end),
    },
    {
      title: `${homeTeamName} Defensive Sets`,
      rowLabels: DEFENSE_ROW_LABELS,
      totals: computeSetCategoryTotals(rawEvents, homeTeamId, visitorTeamId, "defense", start, end),
    },
    {
      title: `${visitorTeamName} Defensive Sets`,
      rowLabels: DEFENSE_ROW_LABELS,
      totals: computeSetCategoryTotals(rawEvents, visitorTeamId, homeTeamId, "defense", start, end),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Values:</span>
          <label className="flex items-center gap-1">
            <input type="radio" checked={perMode === "totals"} onChange={() => setPerMode("totals")} />
            Totals
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={perMode === "per100"} onChange={() => setPerMode("per100")} />
            Per 100 Sets
          </label>
        </label>
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

      {tables.map((table) => {
        const total = sumTotals(table.totals);
        const scale = (sets: number) => (perMode === "totals" ? 1 : sets > 0 ? 100 / sets : 0);

        function copyData() {
          const lines = [["", ...COLUMNS.map((c) => c.label)].join("\t")];
          for (const row of table.totals) {
            lines.push(
              [table.rowLabels[row.category], ...COLUMNS.map((c) => c.render(row, scale(row.sets)))].join("\t")
            );
          }
          lines.push(["TOTAL", ...COLUMNS.map((c) => c.render(total, scale(total.sets)))].join("\t"));
          navigator.clipboard.writeText(lines.join("\n"));
        }

        return (
          <div key={table.title}>
            <button
              onClick={copyData}
              className="mb-2 flex items-center gap-1.5 text-sm italic text-blue-500 hover:underline"
            >
              <CopyIcon className="size-3.5" />
              Copy Data
            </button>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-3 py-2 text-left font-semibold">{table.title}</th>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-2 py-2 text-right text-xs font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.totals.map((row) => (
                    <tr key={row.category} className="border-t border-border/60">
                      <td className="whitespace-nowrap px-3 py-1.5">{table.rowLabels[row.category]}</td>
                      {COLUMNS.map((c) => {
                        const colEvents = c.events(row.events);
                        return (
                          <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">
                            {colEvents.length > 0 ? (
                              <button
                                className="text-blue-500 hover:underline"
                                onClick={() =>
                                  openClips(`${table.rowLabels[row.category]} — ${c.label}`, colEvents)
                                }
                              >
                                {c.render(row, scale(row.sets))}
                              </button>
                            ) : (
                              c.render(row, scale(row.sets))
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                    <td className="px-3 py-1.5">TOTAL</td>
                    {COLUMNS.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {c.render(total, scale(total.sets))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
