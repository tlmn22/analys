"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon, CopyIcon } from "lucide-react";
import { computeFourFactors, type ComparisonTeamStats, type FourFactors } from "./comparison-stats";
import type { PaceStats } from "./pace-stats";
import type { ShootingStats } from "./shooting-stats";

type Cell = { text: string; highlight?: "good" | "bad" };

interface RowContext {
  home: ComparisonTeamStats;
  visitor: ComparisonTeamStats;
  homeFF: FourFactors;
  visitorFF: FourFactors;
  homePace: PaceStats;
  visitorPace: PaceStats;
  homeShooting: ShootingStats;
  visitorShooting: ShootingStats;
}

interface ComparisonRowDef {
  label: string;
  advanced?: boolean;
  /** Key passed to eventsForTeamColumn() when this row's clip drill-down
   * icon is clicked — omit for rows with no clean event-level mapping
   * (PPP, Biggest Lead, Pace, ...). */
  clipKey?: string;
  cells: (ctx: RowContext) => [Cell, Cell];
}

interface ComparisonGroup {
  /** Visible section header spanning the row (matching the reference
   * tool's "Pace"/"Four Factors" labels) — omit for groups that are just
   * loosely related rows without their own heading. */
  name?: string;
  rows: ComparisonRowDef[];
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pctOr = (m: number, a: number) => (a > 0 ? pct(m / a) : "-");
const frac = (m: number, a: number) => `${m}/${a}`;

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtMinSecTenths(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(1).padStart(4, "0")}`;
}

// Rows are organized into groups (alternating shading, matching the
// reference tool) — more groups get appended here as new stats are added.
const GROUPS: ComparisonGroup[] = [
  {
    rows: [
      {
        label: "Points",
        clipKey: "points",
        cells: ({ home, visitor }) => [{ text: String(home.points) }, { text: String(visitor.points) }],
      },
      {
        label: "Pts. Per Possession",
        advanced: true,
        cells: ({ home, visitor }) => [{ text: home.ppp.toFixed(2) }, { text: visitor.ppp.toFixed(2) }],
      },
    ],
  },
  {
    rows: [
      {
        label: "Biggest Lead (or smallest deficit)",
        cells: ({ home, visitor }) => [{ text: String(home.biggestLead) }, { text: String(visitor.biggestLead) }],
      },
      {
        label: "Timeouts Called",
        clipKey: "timeouts",
        cells: ({ home, visitor }) => [{ text: String(home.timeouts) }, { text: String(visitor.timeouts) }],
      },
    ],
  },
  {
    name: "Four Factors",
    // Dean Oliver's Four Factors — each cell highlighted based on standard
    // good/bad direction for that stat (eFG% uses an absolute "good" bar
    // instead of a head-to-head comparison, since both teams can be good).
    rows: [
      {
        label: "Effective FG %",
        cells: ({ homeFF, visitorFF }) => [
          { text: pct(homeFF.efgPct), highlight: homeFF.efgPct >= 0.55 ? "good" : undefined },
          { text: pct(visitorFF.efgPct), highlight: visitorFF.efgPct >= 0.55 ? "good" : undefined },
        ],
      },
      {
        label: "Turnover %",
        advanced: true,
        clipKey: "turnovers",
        cells: ({ homeFF, visitorFF }) => [
          { text: pct(homeFF.tovPct), highlight: homeFF.tovPct > visitorFF.tovPct ? "bad" : undefined },
          { text: pct(visitorFF.tovPct), highlight: visitorFF.tovPct > homeFF.tovPct ? "bad" : undefined },
        ],
      },
      {
        label: "Offensive Reb %",
        advanced: true,
        clipKey: "oreb",
        cells: ({ homeFF, visitorFF }) => [
          { text: pct(homeFF.orebPct), highlight: homeFF.orebPct < visitorFF.orebPct ? "bad" : undefined },
          { text: pct(visitorFF.orebPct), highlight: visitorFF.orebPct < homeFF.orebPct ? "bad" : undefined },
        ],
      },
      {
        label: "Free Throw Rate",
        advanced: true,
        cells: ({ homeFF, visitorFF }) => [
          { text: homeFF.ftRate.toFixed(2), highlight: homeFF.ftRate < visitorFF.ftRate ? "bad" : undefined },
          { text: visitorFF.ftRate.toFixed(2), highlight: visitorFF.ftRate < homeFF.ftRate ? "bad" : undefined },
        ],
      },
    ],
  },
  {
    name: "Pace",
    // Possessions are reconstructed from event sequencing (see
    // pace-stats.ts) — an approximation, since nothing is tagged as an
    // explicit possession boundary.
    rows: [
      {
        label: "Avg. Possession Length",
        cells: ({ homePace, visitorPace }) => [
          { text: fmtMinSecTenths(homePace.avgPossessionLength) },
          { text: fmtMinSecTenths(visitorPace.avgPossessionLength) },
        ],
      },
      {
        label: "Time of Possession",
        cells: ({ homePace, visitorPace }) => [
          { text: fmtMinSec(homePace.timeOfPossession) },
          { text: fmtMinSec(visitorPace.timeOfPossession) },
        ],
      },
      {
        label: "Possessions",
        cells: ({ homePace, visitorPace }) => [
          { text: String(homePace.possessions) },
          { text: String(visitorPace.possessions) },
        ],
      },
    ],
  },
  {
    name: "Shooting",
    // At-the-rim/Short Mid/Long Mid zones are derived from each shot's
    // tagged court location (distance from the rim), not from shot_type —
    // see shooting-stats.ts for the exact thresholds.
    rows: [
      {
        label: "2 Pt.",
        clipKey: "twoPt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: frac(h.fgm2, h.fga2) }, { text: frac(v.fgm2, v.fga2) }],
      },
      {
        label: "2 Pt. %",
        clipKey: "twoPt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.fgm2, h.fga2) },
          { text: pctOr(v.fgm2, v.fga2) },
        ],
      },
      {
        label: "3 Pt.",
        clipKey: "threePt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: frac(h.fgm3, h.fga3) }, { text: frac(v.fgm3, v.fga3) }],
      },
      {
        label: "3 Pt. %",
        clipKey: "threePt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.fgm3, h.fga3) },
          { text: pctOr(v.fgm3, v.fga3) },
        ],
      },
      {
        label: "Effective FG %",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pct(h.efgPct), highlight: h.efgPct >= 0.55 ? "good" : undefined },
          { text: pct(v.efgPct), highlight: v.efgPct >= 0.55 ? "good" : undefined },
        ],
      },
      {
        label: "True Shooting %",
        advanced: true,
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: pct(h.tsPct) }, { text: pct(v.tsPct) }],
      },
      {
        label: "Free Throws",
        clipKey: "ft",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: frac(h.ftm, h.fta) }, { text: frac(v.ftm, v.fta) }],
      },
      {
        label: "Free Throw %",
        clipKey: "ft",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.ftm, h.fta) },
          { text: pctOr(v.ftm, v.fta) },
        ],
      },
      {
        label: "Scoring Opportunities",
        advanced: true,
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: String(h.scoringOpportunities) },
          { text: String(v.scoringOpportunities) },
        ],
      },
      {
        label: "Shots",
        clipKey: "shots",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: String(h.fga) }, { text: String(v.fga) }],
      },
      {
        label: "Free Throw Rate",
        advanced: true,
        clipKey: "ft",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: h.ftRate.toFixed(2), highlight: h.ftRate < v.ftRate ? "bad" : undefined },
          { text: v.ftRate.toFixed(2), highlight: v.ftRate < h.ftRate ? "bad" : undefined },
        ],
      },
      {
        label: "FT Trips",
        advanced: true,
        clipKey: "ft",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: String(h.ftTrips) }, { text: String(v.ftTrips) }],
      },
      {
        label: "At-the-rim Shooting",
        advanced: true,
        clipKey: "atRim",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: frac(h.atRimM, h.atRimA) },
          { text: frac(v.atRimM, v.atRimA) },
        ],
      },
      {
        label: "At-the-rim %",
        advanced: true,
        clipKey: "atRim",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.atRimM, h.atRimA) },
          { text: pctOr(v.atRimM, v.atRimA) },
        ],
      },
      {
        label: "ATR Rate",
        advanced: true,
        clipKey: "atRim",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.atRimA, h.fga) },
          { text: pctOr(v.atRimA, v.fga) },
        ],
      },
      {
        label: "ATR Fouled",
        advanced: true,
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: String(h.atRimFouled) }, { text: String(v.atRimFouled) }],
      },
      {
        label: "Short Mid Shots",
        advanced: true,
        clipKey: "shortMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: frac(h.shortMidM, h.shortMidA) },
          { text: frac(v.shortMidM, v.shortMidA) },
        ],
      },
      {
        label: "Short Mid %",
        advanced: true,
        clipKey: "shortMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.shortMidM, h.shortMidA) },
          { text: pctOr(v.shortMidM, v.shortMidA) },
        ],
      },
      {
        label: "Short Mid Rate",
        advanced: true,
        clipKey: "shortMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.shortMidA, h.fga) },
          { text: pctOr(v.shortMidA, v.fga) },
        ],
      },
      {
        label: "Long Mid Shots",
        advanced: true,
        clipKey: "longMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: frac(h.longMidM, h.longMidA) },
          { text: frac(v.longMidM, v.longMidA) },
        ],
      },
      {
        label: "Long Mid %",
        advanced: true,
        clipKey: "longMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.longMidM, h.longMidA) },
          { text: pctOr(v.longMidM, v.longMidA) },
        ],
      },
      {
        label: "Long Mid Rate",
        advanced: true,
        clipKey: "longMid",
        cells: ({ homeShooting: h, visitorShooting: v }) => [
          { text: pctOr(h.longMidA, h.fga) },
          { text: pctOr(v.longMidA, v.fga) },
        ],
      },
      {
        label: "2 Pt. Rate",
        advanced: true,
        clipKey: "twoPt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: pct(h.twoPtRate) }, { text: pct(v.twoPtRate) }],
      },
      {
        label: "3 Pt. Rate",
        advanced: true,
        clipKey: "threePt",
        cells: ({ homeShooting: h, visitorShooting: v }) => [{ text: pct(h.threePtRate) }, { text: pct(v.threePtRate) }],
      },
    ],
  },
];

const HIGHLIGHT_CLASSES: Record<"good" | "bad", string> = {
  good: "bg-green-200/70",
  bad: "bg-rose-300/70",
};

export function ComparisonTable({
  homeTeamName,
  visitorTeamName,
  homeStats,
  visitorStats,
  homePace,
  visitorPace,
  homeShooting,
  visitorShooting,
  start,
  end,
  onClipClick,
}: {
  homeTeamName: string;
  visitorTeamName: string;
  homeStats: ComparisonTeamStats;
  visitorStats: ComparisonTeamStats;
  homePace: PaceStats;
  visitorPace: PaceStats;
  homeShooting: ShootingStats;
  visitorShooting: ShootingStats;
  start: number;
  end: number;
  onClipClick: (clipKey: string, side: "home" | "visitor") => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [advanced, setAdvanced] = useState(true);

  const ctx: RowContext = {
    home: homeStats,
    visitor: visitorStats,
    homeFF: computeFourFactors(homeStats, visitorStats),
    visitorFF: computeFourFactors(visitorStats, homeStats),
    homePace,
    visitorPace,
    homeShooting,
    visitorShooting,
  };

  const visibleGroups = GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => advanced || !r.advanced) })).filter(
    (g) => g.rows.length > 0
  );

  function copyData() {
    const lines = [["", homeTeamName, visitorTeamName].join("\t")];
    for (const group of visibleGroups) {
      if (group.name) lines.push(group.name);
      for (const row of group.rows) {
        const [h, v] = row.cells(ctx);
        lines.push([row.label, h.text, v.text].join("\t"));
      }
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mb-2 flex items-center gap-2 text-lg font-semibold"
      >
        <span className="flex size-6 items-center justify-center rounded bg-blue-600 text-white">
          {collapsed ? <PlusIcon className="size-4" /> : <MinusIcon className="size-4" />}
        </span>
        Comparison{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({fmtMinSec(start)} - {fmtMinSec(end)})
        </span>
      </button>

      {!collapsed && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!advanced} onChange={() => setAdvanced(false)} />
              <span className="font-medium">Show Basic Stats</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={advanced} onChange={() => setAdvanced(true)} />
              <span className="font-medium">Show ALL Stats (Advanced)</span>
            </label>
          </div>

          <button
            onClick={copyData}
            className="mb-2 flex items-center gap-1.5 text-sm text-blue-500 hover:underline"
          >
            <CopyIcon className="size-3.5" />
            <span className="italic">Copy Data</span>
          </button>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-center font-semibold">{homeTeamName}</th>
                  <th className="px-3 py-2 text-center font-semibold">{visitorTeamName}</th>
                </tr>
              </thead>
              <tbody>
                {visibleGroups.flatMap((group, gi) => [
                  ...(group.name
                    ? [
                        <tr key={`${group.name}-header`} className="border-t border-border bg-background">
                          <td colSpan={3} className="px-3 py-1.5 text-sm font-bold underline">
                            {group.name}
                          </td>
                        </tr>,
                      ]
                    : []),
                  ...group.rows.map((row) => {
                    const [h, v] = row.cells(ctx);
                    return (
                      <tr key={`${gi}-${row.label}`} className={gi % 2 === 0 ? "bg-rose-50/60" : "bg-background"}>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className={`px-3 py-2 text-center ${h.highlight ? HIGHLIGHT_CLASSES[h.highlight] : ""}`}>
                          {row.clipKey ? (
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => onClipClick(row.clipKey!, "home")}
                            >
                              {h.text}
                            </button>
                          ) : (
                            h.text
                          )}
                        </td>
                        <td className={`px-3 py-2 text-center ${v.highlight ? HIGHLIGHT_CLASSES[v.highlight] : ""}`}>
                          {row.clipKey ? (
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => onClipClick(row.clipKey!, "visitor")}
                            >
                              {v.text}
                            </button>
                          ) : (
                            v.text
                          )}
                        </td>
                      </tr>
                    );
                  }),
                ])}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
