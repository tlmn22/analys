"use client";

import { useState } from "react";
import type { RosterPlayer } from "../types";
import { computeEff, fmtMin, type PlayerBoxScore } from "./stats";

interface TeamData {
  id: string;
  name: string;
  roster: RosterPlayer[];
}

const EMPTY_STAT: Omit<PlayerBoxScore, "playerId"> = {
  minSeconds: 0,
  pts: 0,
  fg2m: 0,
  fg2a: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  oreb: 0,
  dreb: 0,
  ast: 0,
  pf: 0,
  to: 0,
  stl: 0,
  blk: 0,
  plusMinus: 0,
};

const COLUMNS = [
  "MIN",
  "PTS",
  "FG",
  "2PT-FG",
  "3PT-FG",
  "FT",
  "OREB",
  "DREB",
  "REB",
  "AST",
  "PF",
  "TO",
  "STL",
  "BLK",
  "+/-",
  "EFF",
];

export function BoxscoreTables({
  homeTeam,
  visitorTeam,
  stats,
}: {
  homeTeam: TeamData;
  visitorTeam: TeamData;
  stats: Record<string, PlayerBoxScore>;
}) {
  const [activeTeamId, setActiveTeamId] = useState(homeTeam.id);
  const team = activeTeamId === homeTeam.id ? homeTeam : visitorTeam;

  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-border">
        {[homeTeam, visitorTeam].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTeamId(t.id)}
            className={`px-4 py-2 text-sm font-semibold ${
              activeTeamId === t.id
                ? "border-b-2 border-blue-500 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <BoxscoreTable roster={team.roster} stats={stats} />
    </div>
  );
}

function BoxscoreTable({
  roster,
  stats,
}: {
  roster: RosterPlayer[];
  stats: Record<string, PlayerBoxScore>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">Players</th>
            {COLUMNS.map((c) => (
              <th key={c} className="px-2 py-1 text-right">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => {
            const s = stats[p.playerId] ?? { playerId: p.playerId, ...EMPTY_STAT };
            const fgm = s.fg2m + s.fg3m;
            const fga = s.fg2a + s.fg3a;
            const reb = s.oreb + s.dreb;
            return (
              <tr key={p.playerId} className="border-b border-border/60">
                <td className="px-2 py-1">{p.number}</td>
                <td className="px-2 py-1">
                  {p.firstName} {p.lastName}
                </td>
                <td className="px-2 py-1 text-right font-mono">{fmtMin(s.minSeconds)}</td>
                <td className="px-2 py-1 text-right">{s.pts}</td>
                <td className="px-2 py-1 text-right">
                  {fgm}-{fga}
                </td>
                <td className="px-2 py-1 text-right">
                  {s.fg2m}-{s.fg2a}
                </td>
                <td className="px-2 py-1 text-right">
                  {s.fg3m}-{s.fg3a}
                </td>
                <td className="px-2 py-1 text-right">
                  {s.ftm}-{s.fta}
                </td>
                <td className="px-2 py-1 text-right">{s.oreb}</td>
                <td className="px-2 py-1 text-right">{s.dreb}</td>
                <td className="px-2 py-1 text-right">{reb}</td>
                <td className="px-2 py-1 text-right">{s.ast}</td>
                <td className="px-2 py-1 text-right">{s.pf}</td>
                <td className="px-2 py-1 text-right">{s.to}</td>
                <td className="px-2 py-1 text-right">{s.stl}</td>
                <td className="px-2 py-1 text-right">{s.blk}</td>
                <td className="px-2 py-1 text-right">
                  {s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus}
                </td>
                <td className="px-2 py-1 text-right">{computeEff(s)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
