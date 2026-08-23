"use client";

import { useMemo, useState } from "react";
import { ScoreMarginCharts } from "./score-margin-charts";
import { ComparisonTable } from "./comparison-table";
import { TimelinesChart } from "./timelines-chart";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { eventsForTeamColumn } from "./clip-predicates";
import { computeComparisonStats } from "./comparison-stats";
import { computePossessions, computePaceStats } from "./pace-stats";
import { computeShootingStats } from "./shooting-stats";
import type { PeriodTotal, RawEvent, ScorePoint } from "./summary-stats";
import type { RosterPlayer } from "../../types";

export function GameSummaryClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeRoster,
  visitorRoster,
  periodTotals,
  finalHome,
  finalVisitor,
  points,
  maxSeconds,
  rawEvents,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeRoster: RosterPlayer[];
  visitorRoster: RosterPlayer[];
  periodTotals: PeriodTotal[];
  finalHome: number;
  finalVisitor: number;
  points: ScorePoint[];
  maxSeconds: number;
  rawEvents: RawEvent[];
}) {
  const [range, setRange] = useState<[number, number] | null>(null);
  const [start, end] = range ?? [0, maxSeconds];
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  const homeStats = computeComparisonStats(rawEvents, points, homeTeamId, true, start, end);
  const visitorStats = computeComparisonStats(rawEvents, points, visitorTeamId, false, start, end);

  const possessionSegments = useMemo(
    () => computePossessions(rawEvents, homeTeamId, visitorTeamId),
    [rawEvents, homeTeamId, visitorTeamId]
  );
  const homePace = computePaceStats(possessionSegments, homeTeamId, start, end);
  const visitorPace = computePaceStats(possessionSegments, visitorTeamId, start, end);

  const homeShooting = computeShootingStats(rawEvents, homeTeamId, start, end);
  const visitorShooting = computeShootingStats(rawEvents, visitorTeamId, start, end);

  function handleClipClick(clipKey: string, side: "home" | "visitor") {
    const teamId = side === "home" ? homeTeamId : visitorTeamId;
    const teamName = side === "home" ? homeTeamName : visitorTeamName;
    const matched = eventsForTeamColumn(clipKey, rawEvents, teamId, start, end);
    setModal({
      title: `${teamName} — ${clipKey}`,
      clips: buildClipEvents(matched, homeTeamId, visitorTeamId),
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <ScoreMarginCharts
        homeTeamName={homeTeamName}
        visitorTeamName={visitorTeamName}
        periodTotals={periodTotals}
        finalHome={finalHome}
        finalVisitor={finalVisitor}
        points={points}
        maxSeconds={maxSeconds}
        range={range}
        onRangeChange={setRange}
      />
      <ComparisonTable
        homeTeamName={homeTeamName}
        visitorTeamName={visitorTeamName}
        homeStats={homeStats}
        visitorStats={visitorStats}
        homePace={homePace}
        visitorPace={visitorPace}
        homeShooting={homeShooting}
        visitorShooting={visitorShooting}
        start={start}
        end={end}
        onClipClick={handleClipClick}
      />
      <TimelinesChart
        homeTeamId={homeTeamId}
        visitorTeamId={visitorTeamId}
        homeTeamName={homeTeamName}
        visitorTeamName={visitorTeamName}
        homeRoster={homeRoster}
        visitorRoster={visitorRoster}
        rawEvents={rawEvents}
        start={start}
        end={end}
      />

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
