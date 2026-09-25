"use client";

import { useMemo, useState } from "react";
import type { RawEvent } from "../game-summary/summary-stats";
import type { RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  computeSetCategoryTotals,
  computeSetOffensePlayRows,
  computeDefenseSetDetailRows,
  type CategoryTotals,
} from "../coaching-stats/coaching-stats";
import { computeBoxScore, computeEff, type PlayerBoxScore, type RawGameEvent } from "../../boxscore/stats";

export interface ScoutingPlayer extends RosterPlayer {
  photoUrl: string | null;
}

interface TeamInput {
  teamId: string;
  opponentTeamId: string;
  teamName: string;
  teamColor: string | null;
  teamLogo: string | null;
  score: number;
  roster: ScoutingPlayer[];
}

function fgOf(t: CategoryTotals): { m: number; a: number } {
  return { m: t.fgm2 + t.fgm3, a: t.fga2 + t.fga3 };
}

function frac(m: number, a: number): string {
  return `${m}/${a}`;
}

function playerLabel(p: ScoutingPlayer): string {
  return `${p.firstName} ${p.lastName}`;
}

function Avatar({ player, size = 36 }: { player: ScoutingPlayer; size?: number }) {
  if (player.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.photoUrl}
        alt={playerLabel(player)}
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold text-muted-foreground"
      style={{ width: size, height: size }}
    >
      #{player.number}
    </div>
  );
}

function TeamLogo({ url, name, size = 56 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-md object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 3).toUpperCase()}
    </div>
  );
}

export function ScoutingReportClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeTeamColor,
  visitorTeamColor,
  homeTeamLogo,
  visitorTeamLogo,
  homeScore,
  visitorScore,
  homeRoster,
  visitorRoster,
  rawEvents,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeTeamColor: string | null;
  visitorTeamColor: string | null;
  homeTeamLogo: string | null;
  visitorTeamLogo: string | null;
  homeScore: number;
  visitorScore: number;
  homeRoster: ScoutingPlayer[];
  visitorRoster: ScoutingPlayer[];
  rawEvents: RawEvent[];
}) {
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  function openClips(title: string, events: RawEvent[]) {
    if (events.length === 0) return;
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  // page.tsx includes clockTime on every RawEvent here (needed for the box
  // score's MIN/+- reconstruction) even though it's not part of the shared
  // RawEvent shape other reports rely on.
  const boxScore = useMemo(
    () => computeBoxScore(rawEvents as unknown as RawGameEvent[], homeTeamId, visitorTeamId),
    [rawEvents, homeTeamId, visitorTeamId]
  );

  const teams: TeamInput[] = [
    {
      teamId: homeTeamId,
      opponentTeamId: visitorTeamId,
      teamName: homeTeamName,
      teamColor: homeTeamColor,
      teamLogo: homeTeamLogo,
      score: homeScore,
      roster: homeRoster,
    },
    {
      teamId: visitorTeamId,
      opponentTeamId: homeTeamId,
      teamName: visitorTeamName,
      teamColor: visitorTeamColor,
      teamLogo: visitorTeamLogo,
      score: visitorScore,
      roster: visitorRoster,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 md:grid-cols-[1fr_auto_1fr]">
        <TeamBanner team={teams[0]} align="left" />
        <div className="flex flex-col items-center px-4 text-muted-foreground">
          <span className="text-xs font-semibold uppercase tracking-wide">vs</span>
          <span className="font-mono text-lg font-bold text-foreground">
            {homeScore} - {visitorScore}
          </span>
        </div>
        <TeamBanner team={teams[1]} align="right" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {teams.map((team) => (
          <TeamColumn key={team.teamId} team={team} rawEvents={rawEvents} boxScore={boxScore} onOpenClips={openClips} />
        ))}
      </div>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function TeamBanner({ team, align }: { team: TeamInput; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse md:justify-self-end" : ""}`}>
      <TeamLogo url={team.teamLogo} name={team.teamName} />
      <div className={align === "right" ? "text-right" : ""}>
        <div className="text-lg font-bold">{team.teamName}</div>
        {team.teamColor && (
          <div
            className="mt-1 flex items-center gap-1.5"
            style={align === "right" ? { justifyContent: "flex-end" } : undefined}
          >
            <span className="size-2.5 rounded-full border border-border/60" style={{ backgroundColor: team.teamColor }} />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="border-b border-border px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: accentColor ?? "#475569" }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1.5 p-4 text-sm">{children}</div>
    </div>
  );
}

function StatRow({
  label,
  value,
  bold,
  onClick,
}: {
  label: string;
  value: string;
  bold?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? "font-semibold" : "pl-4 text-muted-foreground"}`}>
      <span className="truncate">{label}</span>
      {onClick ? (
        <button className="font-mono text-blue-500 hover:underline" onClick={onClick}>
          {value}
        </button>
      ) : (
        <span className="font-mono">{value}</span>
      )}
    </div>
  );
}

function TeamColumn({
  team,
  rawEvents,
  boxScore,
  onOpenClips,
}: {
  team: TeamInput;
  rawEvents: RawEvent[];
  boxScore: Map<string, PlayerBoxScore>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  const { teamId, opponentTeamId, teamName, teamColor, roster } = team;

  const offenseRows = useMemo(
    () => computeSetCategoryTotals(rawEvents, teamId, opponentTeamId, "offense", 0, Infinity),
    [rawEvents, teamId, opponentTeamId]
  );
  const playRows = useMemo(
    () => computeSetOffensePlayRows(rawEvents, teamId, opponentTeamId, 0, Infinity),
    [rawEvents, teamId, opponentTeamId]
  );
  const defenseRows = useMemo(
    () => computeSetCategoryTotals(rawEvents, teamId, opponentTeamId, "defense", 0, Infinity),
    [rawEvents, teamId, opponentTeamId]
  );
  const defenseDetailRows = useMemo(
    () => computeDefenseSetDetailRows(rawEvents, teamId, opponentTeamId, 0, Infinity),
    [rawEvents, teamId, opponentTeamId]
  );

  const transitionRow = offenseRows.find((r) => r.category === "transition")!;
  const unassignedRow = offenseRows.find((r) => r.category === "unassigned")!;
  const setOffenseTotal = playRows.reduce(
    (acc, r) => ({ m: acc.m + fgOf(r.totals).m, a: acc.a + fgOf(r.totals).a }),
    { m: 0, a: 0 }
  );
  const setOffenseEvents = playRows.flatMap((r) => r.totals.events.scoring.concat(r.totals.events.twoPt, r.totals.events.threePt));

  const manToManRow = defenseRows.find((r) => r.category === "man_to_man")!;
  const pressSubRows = defenseDetailRows.filter((r) => r.key.startsWith("press::"));
  const zoneSubRows = defenseDetailRows.filter((r) => r.key.startsWith("zone::"));
  const pressTotal = pressSubRows.reduce((s, r) => s + r.totals.sets, 0);
  const zoneTotal = zoneSubRows.reduce((s, r) => s + r.totals.sets, 0);

  const featured = roster
    .map((p) => ({ player: p, stat: boxScore.get(p.playerId) }))
    .filter((r): r is { player: ScoutingPlayer; stat: PlayerBoxScore } => !!r.stat && (r.stat.pts > 0 || r.stat.oreb + r.stat.dreb > 0))
    .sort((a, b) => computeEff(b.stat) - computeEff(a.stat))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={`${teamName} — Offense`} accentColor={teamColor}>
        <StatRow
          label="Хувилбар дээрээс"
          value={frac(setOffenseTotal.m, setOffenseTotal.a)}
          bold
          onClick={() => onOpenClips(`${teamName} — Хувилбар дээрээс`, setOffenseEvents)}
        />
        {playRows.map((r) => {
          const fg = fgOf(r.totals);
          return (
            <StatRow
              key={r.key}
              label={r.label}
              value={frac(fg.m, fg.a)}
              onClick={() =>
                onOpenClips(
                  `${teamName} — ${r.label}`,
                  r.totals.events.scoring.concat(r.totals.events.twoPt, r.totals.events.threePt)
                )
              }
            />
          );
        })}
        {playRows.length === 0 && <p className="pl-4 text-xs text-muted-foreground">Тэмдэглэгдсэн хувилбар байхгүй.</p>}

        <StatRow
          label="Хурдан довтолгоон"
          value={frac(fgOf(transitionRow).m, fgOf(transitionRow).a)}
          bold
          onClick={() =>
            onOpenClips(
              `${teamName} — Хурдан довтолгоон`,
              transitionRow.events.scoring.concat(transitionRow.events.twoPt, transitionRow.events.threePt)
            )
          }
        />
        <StatRow
          label="Хувилбаргүй"
          value={frac(fgOf(unassignedRow).m, fgOf(unassignedRow).a)}
          bold
          onClick={() =>
            onOpenClips(
              `${teamName} — Хувилбаргүй`,
              unassignedRow.events.scoring.concat(unassignedRow.events.twoPt, unassignedRow.events.threePt)
            )
          }
        />
      </SectionCard>

      <SectionCard title={`${teamName} — Хамгаалалт`} accentColor={teamColor}>
        <StatRow
          label="Man to Man"
          value={String(manToManRow.sets)}
          bold
          onClick={() => onOpenClips(`${teamName} — Man to Man`, manToManRow.events.setTag)}
        />
        <StatRow
          label="Press"
          value={String(pressTotal)}
          bold
          onClick={() => onOpenClips(`${teamName} — Press`, pressSubRows.flatMap((r) => r.totals.events.setTag))}
        />
        {pressSubRows.map((r) => (
          <StatRow
            key={r.key}
            label={r.label.replace("Press — ", "")}
            value={String(r.totals.sets)}
            onClick={() => onOpenClips(`${teamName} — ${r.label}`, r.totals.events.setTag)}
          />
        ))}
        <StatRow
          label="Zone"
          value={String(zoneTotal)}
          bold
          onClick={() => onOpenClips(`${teamName} — Zone`, zoneSubRows.flatMap((r) => r.totals.events.setTag))}
        />
        {zoneSubRows.map((r) => (
          <StatRow
            key={r.key}
            label={r.label.replace("Zone — ", "")}
            value={String(r.totals.sets)}
            onClick={() => onOpenClips(`${teamName} — ${r.label}`, r.totals.events.setTag)}
          />
        ))}
      </SectionCard>

      <SectionCard title={`${teamName} — Онцлох тоглогчид`} accentColor={teamColor}>
        {featured.length === 0 && <p className="text-xs text-muted-foreground">Дата хангалтгүй байна.</p>}
        {featured.map(({ player, stat }) => (
          <button
            key={player.playerId}
            className="flex items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-muted/60"
            onClick={() =>
              onOpenClips(
                `${playerLabel(player)} — Scoring`,
                rawEvents.filter((e) => e.playerId === player.playerId && (e.points ?? 0) > 0)
              )
            }
          >
            <Avatar player={player} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                #{player.number} {playerLabel(player)}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {stat.pts} PTS · {stat.oreb + stat.dreb} REB · {stat.ast} AST
              </div>
            </div>
          </button>
        ))}
      </SectionCard>
    </div>
  );
}
