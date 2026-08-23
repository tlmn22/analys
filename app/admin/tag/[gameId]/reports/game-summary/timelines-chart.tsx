"use client";

import { useMemo, useState } from "react";
import { MinusIcon, PlusIcon, InfoIcon } from "lucide-react";
import { PERIOD_SECONDS, type RawEvent } from "./summary-stats";
import {
  computeOnCourtIntervals,
  computeTimelineMarks,
  type Interval,
  type TimelineMark,
  type TimelineRowMarks,
} from "./timeline-stats";
import type { RosterPlayer } from "../../types";

type CategoryKey = keyof TimelineRowMarks;

const CATEGORIES: { key: CategoryKey; checkboxLabel: string; rowLabel: string; defaultOn: boolean }[] = [
  { key: "shots", checkboxLabel: "Shooting (with FTs)", rowLabel: "Shots", defaultOn: true },
  { key: "turnovers", checkboxLabel: "Turnovers", rowLabel: "TOs", defaultOn: false },
  { key: "rebounds", checkboxLabel: "Rebounds", rowLabel: "Rebs", defaultOn: true },
  { key: "fouls", checkboxLabel: "Fouls", rowLabel: "Fouls", defaultOn: true },
  { key: "assists", checkboxLabel: "Assists", rowLabel: "Assists", defaultOn: true },
  { key: "steals", checkboxLabel: "Steals", rowLabel: "Steals", defaultOn: true },
  { key: "plusMinus", checkboxLabel: "+/-", rowLabel: "+/-", defaultOn: false },
];

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

interface TeamSide {
  teamId: string;
  teamName: string;
  roster: RosterPlayer[];
}

export function TimelinesChart({
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeRoster,
  visitorRoster,
  rawEvents,
  start,
  end,
}: {
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeRoster: RosterPlayer[];
  visitorRoster: RosterPlayer[];
  rawEvents: RawEvent[];
  start: number;
  end: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [categoriesOn, setCategoriesOn] = useState<Record<CategoryKey, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultOn])) as Record<CategoryKey, boolean>
  );
  const [showSide, setShowSide] = useState({ home: true, visitor: true });
  const [showTeamRow, setShowTeamRow] = useState({ home: true, visitor: true });
  const [showPlayerRows, setShowPlayerRows] = useState({ home: true, visitor: true });

  const periods = useMemo(() => {
    const list: number[] = [];
    for (let t = 0; t * PERIOD_SECONDS < end; t++) {
      const periodStart = t * PERIOD_SECONDS;
      const periodEnd = (t + 1) * PERIOD_SECONDS;
      if (periodStart >= start && periodEnd <= end) list.push(t + 1);
    }
    return list;
  }, [start, end]);

  const sides: TeamSide[] = [
    { teamId: homeTeamId, teamName: homeTeamName, roster: homeRoster },
    { teamId: visitorTeamId, teamName: visitorTeamName, roster: visitorRoster },
  ];

  function toggleCategory(key: CategoryKey) {
    setCategoriesOn((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function showAll() {
    setCategoriesOn(Object.fromEntries(CATEGORIES.map((c) => [c.key, true])) as Record<CategoryKey, boolean>);
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
        Timelines{" "}
        <span className="text-sm font-normal text-muted-foreground">
          ({fmtMinSec(start)} - {fmtMinSec(end)})
        </span>
        <InfoIcon className="size-4 text-muted-foreground" />
      </button>

      {!collapsed && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Show Timelines:</span>
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5">
                <input type="checkbox" checked={categoriesOn[c.key]} onChange={() => toggleCategory(c.key)} />
                {c.checkboxLabel}
              </label>
            ))}
            <button
              onClick={showAll}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Show All
            </button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
            {sides.map((side, i) => {
              const key = i === 0 ? "home" : "visitor";
              return (
                <div key={side.teamId} className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={showSide[key]}
                      onChange={() => setShowSide((p) => ({ ...p, [key]: !p[key] }))}
                    />
                    Show <span className="font-semibold">{side.teamName}</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showTeamRow[key]}
                      onChange={() => setShowTeamRow((p) => ({ ...p, [key]: !p[key] }))}
                    />
                    Team Timelines
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showPlayerRows[key]}
                      onChange={() => setShowPlayerRows((p) => ({ ...p, [key]: !p[key] }))}
                    />
                    Player Timelines
                  </label>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-6">
            {sides.map((side, i) => {
              const key = i === 0 ? "home" : "visitor";
              if (!showSide[key]) return null;
              return (
                <TeamTimelineTable
                  key={side.teamId}
                  side={side}
                  rawEvents={rawEvents}
                  periods={periods}
                  categoriesOn={categoriesOn}
                  showTeamRow={showTeamRow[key]}
                  showPlayerRows={showPlayerRows[key]}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function TeamTimelineTable({
  side,
  rawEvents,
  periods,
  categoriesOn,
  showTeamRow,
  showPlayerRows,
}: {
  side: TeamSide;
  rawEvents: RawEvent[];
  periods: number[];
  categoriesOn: Record<CategoryKey, boolean>;
  showTeamRow: boolean;
  showPlayerRows: boolean;
}) {
  const activeCategories = CATEGORIES.filter((c) => categoriesOn[c.key]);
  const teamMarks = useMemo(
    () => computeTimelineMarks(rawEvents, side.teamId, undefined, null),
    [rawEvents, side.teamId]
  );

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="w-44 px-3 py-2 text-left font-semibold">{side.teamName}</th>
            <th className="w-16 px-2 py-2 text-left text-xs font-semibold">Type</th>
            <th className="px-2 py-2 text-left text-xs font-semibold">Timeline</th>
          </tr>
        </thead>
        <tbody>
          {showTeamRow && (
            <RowGroup label="Team" categories={activeCategories} marks={teamMarks} periods={periods} onCourtIntervals={null} />
          )}
          {showPlayerRows &&
            side.roster.map((p) => (
              <PlayerRowGroup
                key={p.playerId}
                player={p}
                teamId={side.teamId}
                rawEvents={rawEvents}
                periods={periods}
                categories={activeCategories}
              />
            ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRowGroup({
  player,
  teamId,
  rawEvents,
  periods,
  categories,
}: {
  player: RosterPlayer;
  teamId: string;
  rawEvents: RawEvent[];
  periods: number[];
  categories: typeof CATEGORIES;
}) {
  const onCourtIntervals = useMemo(
    () => computeOnCourtIntervals(rawEvents, player.playerId, teamId),
    [rawEvents, player.playerId, teamId]
  );
  const marks = useMemo(
    () => computeTimelineMarks(rawEvents, teamId, player.playerId, onCourtIntervals),
    [rawEvents, teamId, player.playerId, onCourtIntervals]
  );

  return (
    <RowGroup
      label={`${player.firstName} ${player.lastName} #${player.number}`}
      categories={categories}
      marks={marks}
      periods={periods}
      onCourtIntervals={onCourtIntervals}
    />
  );
}

function RowGroup({
  label,
  categories,
  marks,
  periods,
  onCourtIntervals,
}: {
  label: string;
  categories: typeof CATEGORIES;
  marks: TimelineRowMarks;
  periods: number[];
  onCourtIntervals: Interval[] | null;
}) {
  if (categories.length === 0) return null;
  return (
    <>
      {categories.map((c, i) => (
        <tr key={c.key} className="border-t border-border/60">
          {i === 0 && (
            <td rowSpan={categories.length} className="border-r border-border px-3 py-2 align-top font-medium">
              {label}
            </td>
          )}
          <td className="border-r border-border px-2 py-1 align-middle text-xs text-muted-foreground">
            {c.rowLabel}:
          </td>
          <td className="p-0">
            <div className="flex">
              {periods.map((p) => (
                <PeriodCell
                  key={p}
                  period={p}
                  marks={marks[c.key]}
                  onCourtIntervals={onCourtIntervals}
                />
              ))}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function PeriodCell({
  period,
  marks,
  onCourtIntervals,
}: {
  period: number;
  marks: TimelineMark[];
  onCourtIntervals: Interval[] | null;
}) {
  const periodStart = (period - 1) * PERIOD_SECONDS;
  const periodEnd = period * PERIOD_SECONDS;
  const pct = (t: number) => `${((Math.min(periodEnd, Math.max(periodStart, t)) - periodStart) / PERIOD_SECONDS) * 100}%`;
  const inThisPeriod = marks.filter((m) => m.t >= periodStart && m.t < periodEnd);

  return (
    <div className={`relative h-7 flex-1 border-r border-border ${onCourtIntervals ? "bg-white" : "bg-muted/70"}`}>
      {onCourtIntervals?.map((iv, i) => {
        const ivStart = Math.max(iv.start, periodStart);
        const ivEnd = Math.min(iv.end, periodEnd);
        if (ivEnd <= ivStart) return null;
        return (
          <div
            key={i}
            className="absolute inset-y-0 bg-muted/70"
            style={{ left: pct(ivStart), width: `calc(${pct(ivEnd)} - ${pct(ivStart)})` }}
          />
        );
      })}
      {inThisPeriod.map((m, i) =>
        m.tick ? (
          <div
            key={i}
            title={m.label}
            className="absolute top-1/2 w-[3px] -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(m.t), height: "70%", backgroundColor: m.color }}
          />
        ) : (
          <div
            key={i}
            title={m.label}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: pct(m.t),
              width: m.radius * 2,
              height: m.radius * 2,
              backgroundColor: m.color,
            }}
          />
        )
      )}
    </div>
  );
}
