"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { computeDefenderRows, computeMatchups, pairPoints, type DefenderRow, type MatchupPair } from "./matchup-stats";

function pct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : "-";
}

export function MatchupsClient({
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
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  function openClips(title: string, events: RawEvent[]) {
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  const rosterById = useMemo(
    () => new Map([...homeRoster, ...visitorRoster].map((p) => [p.playerId, p])),
    [homeRoster, visitorRoster]
  );

  const homeRosterIds = useMemo(() => new Set(homeRoster.map((p) => p.playerId)), [homeRoster]);
  const visitorRosterIds = useMemo(() => new Set(visitorRoster.map((p) => p.playerId)), [visitorRoster]);

  const sides = [
    { teamId: homeTeamId, teamName: homeTeamName, roster: homeRoster, rosterIds: homeRosterIds },
    { teamId: visitorTeamId, teamName: visitorTeamName, roster: visitorRoster, rosterIds: visitorRosterIds },
  ];

  return (
    <div className="flex flex-col gap-10 text-sm">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Defender Summary</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Every 2PT/3PT attempt tagged with a defender — plays faced, how many were stopped (missed), and points
          allowed.
        </p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => (
            <DefenderTable
              key={side.teamId}
              title={`${side.teamName} Defenders`}
              rows={computeDefenderRows(rawEvents, side.roster.map((p) => p.playerId))}
              rosterById={rosterById}
              onOpenClips={openClips}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Top Scoring Matchups</h2>
        <p className="mb-3 text-xs text-muted-foreground">Shooter vs. defender pairs, most points scored first.</p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => (
            <MatchupTable
              key={side.teamId}
              title={`vs. ${side.teamName} Defense`}
              matchups={computeMatchups(rawEvents, side.rosterIds)}
              rosterById={rosterById}
              onOpenClips={openClips}
            />
          ))}
        </div>
      </section>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function DefenderTable({
  title,
  rows,
  rosterById,
  onOpenClips,
}: {
  title: string;
  rows: DefenderRow[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  const sorted = [...rows].sort(
    (a, b) => b.total.reduce((s, e) => s + (e.points ?? 0), 0) - a.total.reduce((s, e) => s + (e.points ?? 0), 0)
  );

  function copyData() {
    const lines = [["Player", "2PT (M-A)", "3PT (M-A)", "Plays Defended", "Stops", "Stop %", "Points Allowed"].join("\t")];
    for (const row of sorted) {
      const name = playerLabel(rosterById.get(row.playerId)!);
      const fgm2 = row.twoPt.filter((e) => e.eventType === "2pt_made").length;
      const fgm3 = row.threePt.filter((e) => e.eventType === "3pt_made").length;
      const stops = row.total.filter((e) => e.eventType.endsWith("_miss")).length;
      const points = row.total.reduce((s, e) => s + (e.points ?? 0), 0);
      lines.push(
        [
          name,
          `${fgm2}-${row.twoPt.length}`,
          `${fgm3}-${row.threePt.length}`,
          String(row.total.length),
          String(stops),
          pct(stops, row.total.length),
          String(points),
        ].join("\t")
      );
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      <button onClick={copyData} className="mb-2 flex items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
        <CopyIcon className="size-3.5" />
        Copy Data
      </button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">{title}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">2PT (M-A)</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">3PT (M-A)</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Plays Defended</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Stops</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Stop %</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Points Allowed</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center text-muted-foreground">
                  Defender бүхий шидэлт тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const name = playerLabel(rosterById.get(row.playerId)!);
              const fgm2 = row.twoPt.filter((e) => e.eventType === "2pt_made").length;
              const fgm3 = row.threePt.filter((e) => e.eventType === "3pt_made").length;
              const stops = row.total.filter((e) => e.eventType.endsWith("_miss")).length;
              const points = row.total.reduce((s, e) => s + (e.points ?? 0), 0);
              return (
                <tr key={row.playerId} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {row.twoPt.length > 0 ? (
                      <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${name} — 2PT Defended`, row.twoPt)}>
                        {fgm2}-{row.twoPt.length}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {row.threePt.length > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onOpenClips(`${name} — 3PT Defended`, row.threePt)}
                      >
                        {fgm3}-{row.threePt.length}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${name} — All Plays Defended`, row.total)}>
                      {row.total.length}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {stops > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onOpenClips(`${name} — Stops`, row.total.filter((e) => e.eventType.endsWith("_miss")))}
                      >
                        {stops}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">{pct(stops, row.total.length)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    {points > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onOpenClips(`${name} — Points Allowed`, row.total.filter((e) => e.eventType.endsWith("_made")))}
                      >
                        {points}
                      </button>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchupTable({
  title,
  matchups,
  rosterById,
  onOpenClips,
}: {
  title: string;
  matchups: MatchupPair[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  function copyData() {
    const lines = [["Shooter", "Defender", "FG (M-A)", "Points"].join("\t")];
    for (const m of matchups) {
      const shooter = rosterById.get(m.shooterId);
      const defender = rosterById.get(m.defenderId);
      if (!shooter || !defender) continue;
      const fgm = m.events.filter((e) => e.eventType.endsWith("_made")).length;
      lines.push([playerLabel(shooter), playerLabel(defender), `${fgm}-${m.events.length}`, String(pairPoints(m))].join("\t"));
    }
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      <button onClick={copyData} className="mb-2 flex items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
        <CopyIcon className="size-3.5" />
        Copy Data
      </button>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">{title}</th>
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Defender</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">FG (M-A)</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Points</th>
            </tr>
          </thead>
          <tbody>
            {matchups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 text-center text-muted-foreground">
                  Тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {matchups.map((m) => {
              const shooter = rosterById.get(m.shooterId);
              const defender = rosterById.get(m.defenderId);
              if (!shooter || !defender) return null;
              const fgm = m.events.filter((e) => e.eventType.endsWith("_made")).length;
              const points = pairPoints(m);
              return (
                <tr key={`${m.shooterId}:${m.defenderId}`} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{playerLabel(shooter)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{playerLabel(defender)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => onOpenClips(`${playerLabel(shooter)} vs ${playerLabel(defender)}`, m.events)}
                    >
                      {fgm}-{m.events.length}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    {points > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() =>
                          onOpenClips(
                            `${playerLabel(shooter)} vs ${playerLabel(defender)} (Points)`,
                            m.events.filter((e) => e.eventType.endsWith("_made"))
                          )
                        }
                      >
                        {points}
                      </button>
                    ) : (
                      "0"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
