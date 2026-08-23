"use client";

import { Button } from "@/components/ui/button";
import { PERIOD_SECONDS, clipScorePoints, type PeriodTotal, type ScorePoint } from "./summary-stats";

const HOME_COLOR = "#16a34a";
const VISITOR_COLOR = "#b91c1c";
const MARGIN_COLOR = "#2563eb";

function fmtMinSec(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function stepPathD(points: { t: number; v: number }[], xScale: (t: number) => number, yScale: (v: number) => number): string {
  if (points.length === 0) return "";
  let d = `M ${xScale(points[0].t)} ${yScale(points[0].v)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    d += ` L ${xScale(cur.t)} ${yScale(prev.v)} L ${xScale(cur.t)} ${yScale(cur.v)}`;
  }
  return d;
}

function niceStep(maxAbs: number, target: number): number {
  const candidates = [1, 2, 5, 10, 15, 20, 25, 50, 100];
  return candidates.find((c) => maxAbs / c <= target) ?? candidates[candidates.length - 1];
}

const WIDTH = 800;
const HEIGHT = 220;
const MARGIN = { top: 10, right: 20, bottom: 30, left: 40 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

export function ScoreMarginCharts({
  homeTeamName,
  visitorTeamName,
  periodTotals,
  finalHome,
  finalVisitor,
  points,
  maxSeconds,
  range,
  onRangeChange,
}: {
  homeTeamName: string;
  visitorTeamName: string;
  periodTotals: PeriodTotal[];
  finalHome: number;
  finalVisitor: number;
  points: ScorePoint[];
  maxSeconds: number;
  range: [number, number] | null;
  onRangeChange: (range: [number, number] | null) => void;
}) {
  const [start, end] = range ?? [0, maxSeconds];

  const clipped = clipScorePoints(points, start, end);
  const homeSeries = clipped.map((p) => ({ t: p.t, v: p.homeScore }));
  const visitorSeries = clipped.map((p) => ({ t: p.t, v: p.visitorScore }));
  const marginSeries = clipped.map((p) => ({ t: p.t, v: p.homeScore - p.visitorScore }));

  const xScale = (t: number) => MARGIN.left + ((t - start) / Math.max(1, end - start)) * PLOT_W;

  const maxScore = Math.max(1, ...homeSeries.map((p) => p.v), ...visitorSeries.map((p) => p.v));
  const scoreStep = niceStep(maxScore, 4);
  const scoreTop = Math.ceil((maxScore * 1.1) / scoreStep) * scoreStep;
  const yScoreScale = (v: number) => MARGIN.top + PLOT_H - (v / scoreTop) * PLOT_H;

  const maxAbsMargin = Math.max(1, ...marginSeries.map((p) => Math.abs(p.v)));
  const marginStep = niceStep(maxAbsMargin, 3);
  const marginTop = Math.ceil((maxAbsMargin * 1.2) / marginStep) * marginStep;
  const yMarginScale = (v: number) => MARGIN.top + PLOT_H / 2 - (v / marginTop) * (PLOT_H / 2);

  const rangeMinutes = (end - start) / 60;
  const xStepMin = rangeMinutes <= 12 ? 2 : rangeMinutes <= 40 ? 5 : 10;
  const xTicks: number[] = [];
  for (let m = 0; m * 60 <= end - start + 1; m += xStepMin) {
    xTicks.push(start + m * 60);
  }

  const scoreYTicks: number[] = [];
  for (let s = 0; s <= scoreTop; s += scoreStep) scoreYTicks.push(s);

  const marginYTicks: number[] = [];
  for (let s = -marginTop; s <= marginTop; s += marginStep) marginYTicks.push(s);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Score and Margin Graph{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({fmtMinSec(start)} - {fmtMinSec(end)})
          </span>
        </h2>
        <Button variant="outline" size="sm" onClick={() => onRangeChange(null)} disabled={!range}>
          Reset Time Range
        </Button>
      </div>

      {/* Per-period score table */}
      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 text-left"></th>
              {periodTotals.map((pt) => (
                <th key={pt.period} className="px-2 py-1.5 text-left">
                  <button
                    onClick={() => onRangeChange([(pt.period - 1) * PERIOD_SECONDS, pt.period * PERIOD_SECONDS])}
                    className="text-blue-500 hover:underline"
                  >
                    Q{pt.period}
                  </button>
                </th>
              ))}
              <th className="px-2 py-1.5 text-left">
                <button onClick={() => onRangeChange(null)} className="text-blue-500 hover:underline">
                  Final
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/60">
              <td className="px-2 py-1.5 font-semibold">{homeTeamName}</td>
              {periodTotals.map((pt) => (
                <td key={pt.period} className="px-2 py-1.5">
                  {pt.homePts}
                </td>
              ))}
              <td className="px-2 py-1.5 font-semibold">{finalHome}</td>
            </tr>
            <tr>
              <td className="px-2 py-1.5 font-semibold">{visitorTeamName}</td>
              {periodTotals.map((pt) => (
                <td key={pt.period} className="px-2 py-1.5">
                  {pt.visitorPts}
                </td>
              ))}
              <td className="px-2 py-1.5 font-semibold">{finalVisitor}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Running Score */}
      <div className="mb-8">
        <p className="mb-2 text-center text-sm font-medium text-muted-foreground">Running Score</p>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {scoreYTicks.map((v) => (
            <g key={v}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yScoreScale(v)}
                y2={yScoreScale(v)}
                stroke="#e5e7eb"
              />
              <text x={MARGIN.left - 8} y={yScoreScale(v) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={t}
              x={xScale(t)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {Math.round((t - start) / 60)}
            </text>
          ))}
          <path d={stepPathD(homeSeries, xScale, yScoreScale)} fill="none" stroke={HOME_COLOR} strokeWidth={2} />
          <path
            d={stepPathD(visitorSeries, xScale, yScoreScale)}
            fill="none"
            stroke={VISITOR_COLOR}
            strokeWidth={2}
          />
          <text x={WIDTH / 2} y={HEIGHT} textAnchor="middle" fontSize="11" fill="#6b7280">
            Minutes
          </text>
        </svg>
        <div className="mt-1 flex items-center justify-center gap-5 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: HOME_COLOR }} />
            {homeTeamName}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: VISITOR_COLOR }} />
            {visitorTeamName}
          </span>
        </div>
      </div>

      {/* Margin */}
      <div>
        <p className="mb-2 text-center text-sm font-medium text-muted-foreground">Margin</p>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {marginYTicks.map((v) => (
            <g key={v}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yMarginScale(v)}
                y2={yMarginScale(v)}
                stroke={v === 0 ? "#9ca3af" : "#e5e7eb"}
              />
              <text x={MARGIN.left - 8} y={yMarginScale(v) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                {v}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={t}
              x={xScale(t)}
              y={HEIGHT - MARGIN.bottom + 16}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {Math.round((t - start) / 60)}
            </text>
          ))}
          <path d={stepPathD(marginSeries, xScale, yMarginScale)} fill="none" stroke={MARGIN_COLOR} strokeWidth={2} />
          <text x={WIDTH / 2} y={HEIGHT} textAnchor="middle" fontSize="11" fill="#6b7280">
            Minutes
          </text>
        </svg>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Эерэг = {homeTeamName} тэргүүлж байна, сөрөг = {visitorTeamName} тэргүүлж байна
        </p>
      </div>
    </div>
  );
}
