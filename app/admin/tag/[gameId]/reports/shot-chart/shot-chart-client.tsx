"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon, VideoIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { ShotCourtChart, type ChartDot, type AreaSelection } from "./court-chart";
import { buildShotEntries, type ShotEntry } from "./shot-derived";
import type { RosterPlayer } from "../../types";

type ShowMode = "all" | "made" | "missed" | "fouled" | "assisted" | "blocked";

interface TeamSide {
  teamId: string;
  teamName: string;
  roster: RosterPlayer[];
}

const MADE_COLOR = "#16a34a";
const MISS_COLOR = "#dc2626";

function passesBaseFilters(
  s: ShotEntry,
  distRange: [number, number],
  shotType: "all" | "2pt" | "3pt",
  showMode: ShowMode,
  orebOnly: boolean,
  drebOnly: boolean
): boolean {
  const [dMin, dMax] = distRange;
  if (s.distanceFt < dMin) return false;
  if (dMax < 30 && s.distanceFt > dMax) return false;
  if (shotType === "2pt" && s.is3pt) return false;
  if (shotType === "3pt" && !s.is3pt) return false;
  if (showMode === "made" && !s.isMade) return false;
  if (showMode === "missed" && s.isMade) return false;
  if (showMode === "fouled" && !s.isFouled) return false;
  if (showMode === "assisted" && !s.isAssisted) return false;
  if (showMode === "blocked" && !s.isBlocked) return false;
  if (orebOnly && !s.hasOReb) return false;
  if (drebOnly && !s.hasDReb) return false;
  return true;
}

function pct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : "-";
}

export function ShotChartClient({
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
  const [distRange, setDistRange] = useState<[number, number]>([0, 30]);
  const [shotType, setShotType] = useState<"all" | "2pt" | "3pt">("all");
  const [showMode, setShowMode] = useState<ShowMode>("all");
  const [orebOnly, setOrebOnly] = useState(false);
  const [drebOnly, setDrebOnly] = useState(false);
  const [composite, setComposite] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set([homeTeamId]));
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [excludeSelected, setExcludeSelected] = useState(false);
  const [areaSelection, setAreaSelection] = useState<AreaSelection | null>(null);
  const [excludeArea, setExcludeArea] = useState(false);
  const [dotSize, setDotSize] = useState(6);
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  const allShots = useMemo(() => buildShotEntries(rawEvents), [rawEvents]);
  const filtered = useMemo(
    () => allShots.filter((s) => passesBaseFilters(s, distRange, shotType, showMode, orebOnly, drebOnly)),
    [allShots, distRange, shotType, showMode, orebOnly, drebOnly]
  );

  function isSelected(s: ShotEntry): boolean {
    const matches =
      (s.event.teamId && selectedTeams.has(s.event.teamId)) ||
      (s.event.playerId && selectedPlayers.has(s.event.playerId));
    return excludeSelected ? !matches : !!matches;
  }

  function inArea(s: ShotEntry): boolean {
    if (!areaSelection) return true;
    const { shotX, shotY } = s.event;
    if (shotX === null || shotY === null) return excludeArea;
    const inside =
      shotX >= areaSelection.xMin &&
      shotX <= areaSelection.xMax &&
      shotY >= areaSelection.yMin &&
      shotY <= areaSelection.yMax;
    return excludeArea ? !inside : inside;
  }

  const visible = filtered.filter(isSelected).filter(inArea);

  const sides: TeamSide[] = [
    { teamId: homeTeamId, teamName: homeTeamName, roster: homeRoster },
    { teamId: visitorTeamId, teamName: visitorTeamName, roster: visitorRoster },
  ];

  function toggleTeam(teamId: string) {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }
  function togglePlayer(playerId: string) {
    setSelectedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function statsFor(shots: ShotEntry[]) {
    const made = shots.filter((s) => s.isMade).length;
    const total = shots.length;
    const points = shots.reduce((sum, s) => sum + (s.event.points ?? 0), 0);
    return { made, total, points };
  }

  const dots: ChartDot[] = useMemo(() => {
    if (!composite) {
      return visible
        .filter((s) => s.event.shotX !== null && s.event.shotY !== null)
        .map((s) => ({
          key: s.event.id,
          x: s.event.shotX as number,
          y: s.event.shotY as number,
          color: s.isMade ? MADE_COLOR : MISS_COLOR,
          made: s.isMade,
          radius: dotSize,
          onClick: () =>
            setModal({
              title: `${s.event.eventType}${s.event.shotType ? `: ${s.event.shotType}` : ""}`,
              clips: buildClipEvents([s.event], homeTeamId, visitorTeamId),
            }),
        }));
    }
    // Composite: one averaged dot per selected team/player group.
    const groups: { key: string; label: string; shots: ShotEntry[] }[] = [];
    for (const teamId of selectedTeams) {
      groups.push({ key: `team:${teamId}`, label: teamId, shots: visible.filter((s) => s.event.teamId === teamId) });
    }
    for (const playerId of selectedPlayers) {
      groups.push({
        key: `player:${playerId}`,
        label: playerId,
        shots: visible.filter((s) => s.event.playerId === playerId),
      });
    }
    return groups
      .filter((g) => g.shots.length > 0)
      .map((g) => {
        const withLoc = g.shots.filter((s) => s.event.shotX !== null && s.event.shotY !== null);
        const avgX = withLoc.reduce((s, e) => s + (e.event.shotX as number), 0) / (withLoc.length || 1);
        const avgY = withLoc.reduce((s, e) => s + (e.event.shotY as number), 0) / (withLoc.length || 1);
        const madeShare = g.shots.filter((s) => s.isMade).length / g.shots.length;
        return {
          key: g.key,
          x: avgX,
          y: avgY,
          color: madeShare >= 0.5 ? MADE_COLOR : MISS_COLOR,
          made: madeShare >= 0.5,
          radius: dotSize + 3,
        };
      });
  }, [visible, composite, selectedTeams, selectedPlayers, dotSize, homeTeamId, visitorTeamId]);

  const visibleStats = statsFor(visible);
  const visibleOreb = visible.filter((s) => s.hasOReb).length;
  const visibleDreb = visible.filter((s) => s.hasDReb).length;
  const selectionTeamIds = new Set<string>();
  for (const t of selectedTeams) selectionTeamIds.add(t);
  for (const s of allShots) {
    if (s.event.playerId && selectedPlayers.has(s.event.playerId) && s.event.teamId) {
      selectionTeamIds.add(s.event.teamId);
    }
  }
  const teamTotalShots = allShots.filter((s) => s.event.teamId && selectionTeamIds.has(s.event.teamId)).length;

  function playClips() {
    setModal({
      title: "Visible Shots",
      clips: buildClipEvents(
        visible.map((s) => s.event),
        homeTeamId,
        visitorTeamId
      ),
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex w-full flex-col gap-4 text-sm lg:w-72">
        <div>
          <div className="mb-1 text-muted-foreground">Shot Distance:</div>
          <DistanceSlider value={distRange} onChange={setDistRange} />
        </div>

        <div>
          <div className="mb-1 flex items-center gap-3">
            <span className="text-muted-foreground">Shot Type:</span>
            {(["all", "3pt", "2pt"] as const).map((t) => (
              <label key={t} className="flex items-center gap-1">
                <input type="radio" checked={shotType === t} onChange={() => setShotType(t)} />
                {t === "all" ? "All" : t === "3pt" ? "3 Pt" : "2 Pt"}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-muted-foreground">Show:</span>
            <span />
            {(
              [
                ["all", "All Shots"],
                ["made", "Made"],
                ["missed", "Missed"],
                ["fouled", "Fouled"],
                ["assisted", "Assisted"],
                ["blocked", "Blocked"],
              ] as [ShowMode, string][]
            ).map(([mode, label]) => (
              <label key={mode} className="flex items-center gap-1.5">
                <input type="radio" checked={showMode === mode} onChange={() => setShowMode(mode)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={orebOnly} onChange={(e) => setOrebOnly(e.target.checked)} />
            Just Show Shots with Offensive Rebounds
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={drebOnly} onChange={(e) => setDrebOnly(e.target.checked)} />
            Just Show Shots with Defensive Rebounds
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={composite} onChange={(e) => setComposite(e.target.checked)} />
            Show Composite &quot;Average&quot; Shot Location
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={excludeArea} onChange={(e) => setExcludeArea(e.target.checked)} />
            Exclude shots in selected area
          </label>
          {areaSelection && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Area selected on court
              <button onClick={() => setAreaSelection(null)} className="text-blue-500 hover:underline">
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {sides.map((side) => {
            const teamShots = filtered.filter((s) => s.event.teamId === side.teamId);
            const st = statsFor(teamShots);
            return (
              <div key={side.teamId}>
                <label className="flex items-center gap-1.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={selectedTeams.has(side.teamId)}
                    onChange={() => toggleTeam(side.teamId)}
                  />
                  {side.teamName} {st.made}/{st.total} = {pct(st.made, st.total)}
                </label>
                <div className="ml-4 flex flex-col">
                  {side.roster.map((p) => {
                    const playerShots = filtered.filter((s) => s.event.playerId === p.playerId);
                    const ps = statsFor(playerShots);
                    if (ps.total === 0) return null;
                    return (
                      <label key={p.playerId} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={selectedPlayers.has(p.playerId)}
                          onChange={() => togglePlayer(p.playerId)}
                        />
                        {p.firstName} {p.lastName} #{p.number}: {ps.made}/{ps.total} = {pct(ps.made, ps.total)}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={excludeSelected} onChange={(e) => setExcludeSelected(e.target.checked)} />
          Exclude selected players
        </label>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Dot Size:</span>
          <button
            onClick={() => setDotSize((d) => Math.max(2, d - 1))}
            className="flex size-6 items-center justify-center rounded bg-orange-500 text-white"
          >
            <MinusIcon className="size-3.5" />
          </button>
          <button
            onClick={() => setDotSize((d) => Math.min(14, d + 1))}
            className="flex size-6 items-center justify-center rounded bg-orange-500 text-white"
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>

        <Button onClick={playClips} disabled={visible.length === 0} className="gap-1.5">
          <VideoIcon className="size-4" />
          Play Video Clips
        </Button>
      </div>

      <div className="flex-1">
        <ShotCourtChart dots={dots} selection={areaSelection} onSelectionChange={setAreaSelection} />
        <p className="mt-1 text-xs text-muted-foreground">
          Drag on the court to select an area — Play Video Clips will then only include shots inside it.
        </p>
        <div className="mt-3 space-y-0.5 text-sm text-muted-foreground">
          <p>
            Visible Shots: {visibleStats.made}/{visibleStats.total} = {pct(visibleStats.made, visibleStats.total)}
          </p>
          <p>{visibleStats.total > 0 ? (visibleStats.points / visibleStats.total).toFixed(1) : "0.0"} points per shot</p>
          <p>
            {teamTotalShots > 0 ? Math.round((visibleStats.total / teamTotalShots) * 100) : 0}% of all team shots
            taken
          </p>
          <p>
            Visible Shot Rebounds - Off: {visibleOreb} Def: {visibleDreb} OReb Pct ={" "}
            {pct(visibleOreb, visibleOreb + visibleDreb)}
          </p>
        </div>
      </div>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function DistanceSlider({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [min, max] = value;
  return (
    <div>
      <div className="relative h-6">
        <input
          type="range"
          min={0}
          max={30}
          value={min}
          onChange={(e) => onChange([Math.min(Number(e.target.value), max), max])}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
        <input
          type="range"
          min={0}
          max={30}
          value={max}
          onChange={(e) => onChange([min, Math.max(Number(e.target.value), min)])}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {[0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30].map((t) => (
          <span key={t}>{t === 30 ? "30+" : t}</span>
        ))}
      </div>
    </div>
  );
}
