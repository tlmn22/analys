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
import { computePossessions } from "../game-summary/pace-stats";
import { computeActionRows } from "../screens-pnr/screen-stats";
import { boxoutRate, computeBoxoutSummary } from "./boxout-stats";
import { computeStarters, splitRotation, type LineupEvent } from "./rotation-stats";
import { computePossessionTypes, type PossessionType } from "../possession-types";

const POSSESSION_TYPE_STYLE: Record<Exclude<PossessionType, "unmatched">, { label: string; bar: string }> = {
  transition: { label: "Хурдан довтолгоо", bar: "bg-emerald-500" },
  set: { label: "Хувилбартай", bar: "bg-sky-500" },
  inbound: { label: "BLOB / SLOB", bar: "bg-violet-500" },
  unstructured: { label: "Замбараагүй", bar: "bg-zinc-400 dark:bg-zinc-500" },
};
const POSSESSION_TYPE_ORDER = ["transition", "set", "inbound", "unstructured"] as const;
import { ChevronRightIcon } from "lucide-react";

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

/** "FG m/a · N оноо" for an offensive set row. */
function fgPoints(t: CategoryTotals): string {
  const fg = fgOf(t);
  return `${frac(fg.m, fg.a)} · ${t.points} оноо`;
}

/** "N оноо / M эз · PPP" — points allowed per defended possession. */
function allowed(points: number, possessions: number): string {
  return `${points} оноо / ${possessions} эз · ${possessions ? (points / possessions).toFixed(2) : "—"}`;
}

const shotEvents = (t: CategoryTotals) => t.events.scoring.concat(t.events.twoPt, t.events.threePt);

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
  expanded,
  onToggle,
}: {
  label: string;
  value: string;
  bold?: boolean;
  onClick?: () => void;
  /** With onToggle, the label becomes a disclosure button for the rows below. */
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? "font-semibold" : "pl-4 text-muted-foreground"}`}>
      {onToggle ? (
        <button type="button" aria-expanded={!!expanded} onClick={onToggle} className="flex min-w-0 items-center gap-1 text-left hover:underline">
          <ChevronRightIcon className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <span className="truncate">{label}</span>
        </button>
      ) : (
        <span className="truncate">{label}</span>
      )}
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
  // Breakdowns (plays, press/zone types, box out players) start collapsed.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string, hasRows: boolean) =>
    hasRows ? () => setOpen((prev) => ({ ...prev, [key]: !prev[key] })) : undefined;

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
  const setOffensePoints = playRows.reduce((s, r) => s + r.totals.points, 0);
  const blobRow = offenseRows.find((r) => r.category === "blob")!;
  const slobRow = offenseRows.find((r) => r.category === "slob")!;

  const coverageRows = useMemo(() => {
    const possessions = computePossessions(rawEvents, teamId, opponentTeamId);
    const rows = computeActionRows(rawEvents, teamId, opponentTeamId, "defense", "def_coverage", (e) => e.defCoverageType ?? null, possessions, 0, Infinity);
    return [...rows.values()].sort((a, b) => b.count - a.count);
  }, [rawEvents, teamId, opponentTeamId]);
  const boxouts = useMemo(() => computeBoxoutSummary(rawEvents, teamId, opponentTeamId), [rawEvents, teamId, opponentTeamId]);
  const possessionTypes = useMemo(() => computePossessionTypes(rawEvents, teamId, opponentTeamId), [rawEvents, teamId, opponentTeamId]);
  const totalPossessions = possessionTypes.rows.reduce((s, r) => s + r.possessions, 0);
  const typeRow = (type: Exclude<PossessionType, "unmatched">) => possessionTypes.rows.find((r) => r.type === type)!;
  const boxoutPct = boxoutRate(boxouts.good.length, boxouts.bad.length);
  const rosterById = new Map(roster.map((p) => [p.playerId, p]));

  // page.tsx passes clockTime/videoTime on every event (see boxScore above).
  const rotation = useMemo(() => {
    const starters = computeStarters(rawEvents as unknown as LineupEvent[], teamId);
    const played = roster
      .map((p) => boxScore.get(p.playerId))
      .filter((s): s is PlayerBoxScore => !!s && (s.minSeconds > 0 || s.pts > 0 || starters.has(s.playerId)));
    return { hasStarters: starters.size > 0, ...splitRotation(played, starters) };
  }, [rawEvents, teamId, roster, boxScore]);
  const teamPoints = rotation.starters.points + rotation.bench.points;
  const scoringFor = (ids: string[]) => rawEvents.filter((e) => e.playerId && ids.includes(e.playerId) && (e.points ?? 0) > 0);

  const manToManRow = defenseRows.find((r) => r.category === "man_to_man")!;
  const pressSubRows = defenseDetailRows.filter((r) => r.key.startsWith("press::"));
  const zoneSubRows = defenseDetailRows.filter((r) => r.key.startsWith("zone::"));
  const pressTotal = pressSubRows.reduce((s, r) => s + r.totals.sets, 0);
  const zoneTotal = zoneSubRows.reduce((s, r) => s + r.totals.sets, 0);
  const pressPoints = pressSubRows.reduce((s, r) => s + r.totals.points, 0);
  const zonePoints = zoneSubRows.reduce((s, r) => s + r.totals.points, 0);

  const featured = roster
    .map((p) => ({ player: p, stat: boxScore.get(p.playerId) }))
    .filter((r): r is { player: ScoutingPlayer; stat: PlayerBoxScore } => !!r.stat && (r.stat.pts > 0 || r.stat.oreb + r.stat.dreb > 0))
    .sort((a, b) => computeEff(b.stat) - computeEff(a.stat))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={`${teamName} — Довтолгооны бүтэц`} accentColor={teamColor}>
        <p className="text-xs text-muted-foreground">{totalPossessions} эзэмшил · эзэмшил бүр нэг төрөлд · оноо / эзэмшил · PPP</p>
        {totalPossessions > 0 && (
          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            {POSSESSION_TYPE_ORDER.map((type) => {
              const share = typeRow(type).possessions / totalPossessions;
              return share > 0 ? <div key={type} className={POSSESSION_TYPE_STYLE[type].bar} style={{ width: `${share * 100}%` }} /> : null;
            })}
          </div>
        )}
        {POSSESSION_TYPE_ORDER.map((type) => {
          const r = typeRow(type);
          const pct = totalPossessions ? Math.round((r.possessions / totalPossessions) * 100) : 0;
          return (
            <StatRow
              key={type}
              label={`${POSSESSION_TYPE_STYLE[type].label} · ${pct}% · FG ${frac(r.fgm, r.fga)} · TO ${r.turnovers}`}
              value={allowed(r.points, r.possessions)}
              bold
              onClick={() => onOpenClips(`${teamName} — ${POSSESSION_TYPE_STYLE[type].label}`, r.events)}
            />
          );
        })}
        {possessionTypes.unmatched.points > 0 && (
          <button
            type="button"
            className="text-left text-xs text-muted-foreground hover:underline"
            onClick={() => onOpenClips(`${teamName} — эзэмшилд хамааруулаагүй`, possessionTypes.unmatched.events)}
          >
            Эзэмшилд хамааруулж чадаагүй {possessionTypes.unmatched.points} оноо (Def Reb зэрэг tag дутуу).
          </button>
        )}
      </SectionCard>

      <SectionCard title={`${teamName} — Offense`} accentColor={teamColor}>
        <StatRow
          label="Хувилбар дээрээс"
          value={`${frac(setOffenseTotal.m, setOffenseTotal.a)} · ${setOffensePoints} оноо`}
          bold
          onClick={() => onOpenClips(`${teamName} — Хувилбар дээрээс`, setOffenseEvents)}
          expanded={open.plays}
          onToggle={toggle("plays", playRows.length > 0)}
        />
        {open.plays && playRows.map((r) => {
          return (
            <StatRow
              key={r.key}
              label={r.label}
              value={fgPoints(r.totals)}
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
          value={fgPoints(transitionRow)}
          bold
          onClick={() =>
            onOpenClips(
              `${teamName} — Хурдан довтолгоон`,
              transitionRow.events.scoring.concat(transitionRow.events.twoPt, transitionRow.events.threePt)
            )
          }
        />
        {[blobRow, slobRow].map((r) => (
          <StatRow
            key={r.category}
            label={r.category === "blob" ? "BLOB (доод шугамаас)" : "SLOB (хажуу шугамаас)"}
            value={fgPoints(r)}
            bold
            onClick={() => onOpenClips(`${teamName} — ${r.category.toUpperCase()}`, shotEvents(r))}
          />
        ))}
        <StatRow
          label="Хувилбаргүй"
          value={fgPoints(unassignedRow)}
          bold
          onClick={() =>
            onOpenClips(
              `${teamName} — Хувилбаргүй`,
              unassignedRow.events.scoring.concat(unassignedRow.events.twoPt, unassignedRow.events.threePt)
            )
          }
        />
      </SectionCard>

      <SectionCard title={`${teamName} — Гараа / Сэлгээ`} accentColor={teamColor}>
        {!rotation.hasStarters && <p className="text-xs text-muted-foreground">Гарааны 5 тэмдэглэгдээгүй тул бүх тоглогч сэлгээнд тоологдож байна.</p>}
        {([["starters", "Гараа", rotation.starters], ["bench", "Сэлгээ", rotation.bench]] as const).map(([key, label, group]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <StatRow
              label={`${label} (${group.players.length})`}
              value={`${group.points} оноо${teamPoints ? ` · ${Math.round((group.points / teamPoints) * 100)}%` : ""}`}
              bold
              onClick={() => onOpenClips(`${teamName} — ${label}`, scoringFor(group.players.map((p) => p.playerId)))}
              expanded={open[key]}
              onToggle={toggle(key, group.players.length > 0)}
            />
            {open[key] && group.players.map((stat) => {
              const player = rosterById.get(stat.playerId);
              const name = player ? playerLabel(player) : "Тоглогч";
              return (
                <StatRow
                  key={stat.playerId}
                  label={player ? `#${player.number} ${name}` : name}
                  value={`${stat.pts} оноо · ${Math.round(stat.minSeconds / 60)} мин`}
                  onClick={() => onOpenClips(`${name} — оноо`, scoringFor([stat.playerId]))}
                />
              );
            })}
          </div>
        ))}
      </SectionCard>

      <SectionCard title={`${teamName} — Хамгаалалт`} accentColor={teamColor}>
        <StatRow
          label="Man to Man"
          value={allowed(manToManRow.points, manToManRow.sets)}
          bold
          onClick={() => onOpenClips(`${teamName} — Man to Man`, manToManRow.events.setTag)}
        />
        <StatRow
          label="Press"
          value={allowed(pressPoints, pressTotal)}
          bold
          onClick={() => onOpenClips(`${teamName} — Press`, pressSubRows.flatMap((r) => r.totals.events.setTag))}
          expanded={open.press}
          onToggle={toggle("press", pressSubRows.length > 0)}
        />
        {open.press && pressSubRows.map((r) => (
          <StatRow
            key={r.key}
            label={r.label.replace("Press — ", "")}
            value={allowed(r.totals.points, r.totals.sets)}
            onClick={() => onOpenClips(`${teamName} — ${r.label}`, r.totals.events.setTag)}
          />
        ))}
        <StatRow
          label="Zone"
          value={allowed(zonePoints, zoneTotal)}
          bold
          onClick={() => onOpenClips(`${teamName} — Zone`, zoneSubRows.flatMap((r) => r.totals.events.setTag))}
          expanded={open.zone}
          onToggle={toggle("zone", zoneSubRows.length > 0)}
        />
        {open.zone && zoneSubRows.map((r) => (
          <StatRow
            key={r.key}
            label={r.label.replace("Zone — ", "")}
            value={allowed(r.totals.points, r.totals.sets)}
            onClick={() => onOpenClips(`${teamName} — ${r.label}`, r.totals.events.setTag)}
          />
        ))}
      </SectionCard>

      <SectionCard title={`${teamName} — PnR хамгаалалт`} accentColor={teamColor}>
        <p className="text-xs text-muted-foreground">Coverage тус бүр дээр алдсан оноо / эзэмшил · PPP</p>
        {coverageRows.map((r) => (
          <StatRow
            key={r.category}
            label={`${r.category} · FG ${frac(r.fgm, r.fga)}`}
            value={allowed(r.points, r.count)}
            bold
            onClick={() => onOpenClips(`${teamName} — PnR ${r.category}`, r.tagEvents)}
          />
        ))}
        {coverageRows.length === 0 && <p className="pl-4 text-xs text-muted-foreground">PnR coverage тэмдэглэгдээгүй.</p>}
      </SectionCard>

      <SectionCard title={`${teamName} — Box out`} accentColor={teamColor}>
        <StatRow
          label="Сайн / Муу"
          value={`${boxouts.good.length} / ${boxouts.bad.length}${boxoutPct === null ? "" : ` · ${Math.round(boxoutPct * 100)}%`}`}
          bold
          onClick={() => onOpenClips(`${teamName} — Box out`, boxouts.bad.concat(boxouts.good))}
          expanded={open.boxout}
          onToggle={toggle("boxout", boxouts.rows.length > 0)}
        />
        {open.boxout && boxouts.rows.map((r) => {
          const player = rosterById.get(r.playerId);
          const name = player ? playerLabel(player) : "Тоглогч";
          return (
            <StatRow
              key={r.playerId}
              label={player ? `#${player.number} ${name}` : name}
              value={`${r.good.length} сайн · ${r.bad.length} муу`}
              onClick={() => onOpenClips(`${name} — Box out`, r.bad.concat(r.good))}
            />
          );
        })}
        {boxouts.rows.length === 0 && <p className="pl-4 text-xs text-muted-foreground">Box out тэмдэглэгдээгүй.</p>}
        <StatRow
          label="Өрсөлдөгчийн довтолгооны самбар"
          value={String(boxouts.opponentOreb.length)}
          bold
          onClick={() => onOpenClips(`${teamName} — Өрсөлдөгчийн OREB`, boxouts.opponentOreb)}
        />
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
