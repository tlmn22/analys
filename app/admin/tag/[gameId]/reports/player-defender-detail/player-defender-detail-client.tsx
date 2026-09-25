"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  computeDefenderContestRows,
  computeShooterContestRows,
  CONTEST_TIERS,
  CONTEST_TIER_LABELS,
  type ContestCell,
  type ContestTier,
  type PlayerContestRow,
} from "../defender-contest-stats";

function pct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : "-";
}

export function PlayerDefenderDetailClient({
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

  const sides = [
    { teamId: homeTeamId, teamName: homeTeamName, roster: homeRoster },
    { teamId: visitorTeamId, teamName: visitorTeamName, roster: visitorRoster },
  ];

  return (
    <div className="flex flex-col gap-10 text-sm">
      <section className="flex flex-col gap-8">
        <div>
          <h2 className="mb-1 text-lg font-semibold">Шидэлт хийхэд хэр ойрхон хамгаалуулсан бэ (Offense)</h2>
          <p className="text-xs text-muted-foreground">
            Тоглогч бүрийн ӨӨРИЙНХ нь бүх 2PT/3PT шидэлт, тэднийг хэр ойрхон хамгаалж байсан төрлөөр (Contested/
            Lightly Contested/...) задалсан — жишээ нь Player1 Contested төрлөөр 1 удаа хамгаалуулсан гэдгийг эндээс
            харна.
          </p>
        </div>
        {sides.map((side) => (
          <ContestDetailTable
            key={side.teamId}
            teamName={side.teamName}
            rows={computeShooterContestRows(rawEvents, side.roster.map((p) => p.playerId))}
            rosterById={rosterById}
            onOpenClips={openClips}
            emptyLabel="Тэмдэглэгдсэн шидэлт байхгүй байна."
          />
        ))}
      </section>

      <section className="flex flex-col gap-8">
        <div>
          <h2 className="mb-1 text-lg font-semibold">1v1 хамгаалалт хийхэд хэр ойрхон хамгаалсан бэ (Defense)</h2>
          <p className="text-xs text-muted-foreground">
            Тоглогч бүрийн 1v1 хамгаалагчаар тагласан бүх 2PT/3PT шидэлт, хамгаалалт хэр ойрхон байсан төрлөөр
            задалсан — бүх талбарыг хамарна, зөвхөн 3-ийн биш (3-ийн дан ганцыг харах бол 3PT Contest тайланг үзнэ үү).
          </p>
        </div>
        {sides.map((side) => (
          <ContestDetailTable
            key={side.teamId}
            teamName={side.teamName}
            rows={computeDefenderContestRows(rawEvents, side.roster.map((p) => p.playerId))}
            rosterById={rosterById}
            onOpenClips={openClips}
            emptyLabel="1v1 хамгаалалт тэмдэглэгдээгүй байна."
          />
        ))}
      </section>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function cellOf(row: PlayerContestRow, tier: ContestTier): ContestCell {
  return row.byTier.get(tier) ?? { makes: 0, attempts: 0, events: [] };
}

function ContestDetailTable({
  teamName,
  rows,
  rosterById,
  onOpenClips,
  emptyLabel,
}: {
  teamName: string;
  rows: PlayerContestRow[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
  emptyLabel: string;
}) {
  const sorted = [...rows].sort((a, b) => b.total.attempts - a.total.attempts);
  const tiers = CONTEST_TIERS.filter(
    (t) => t !== "Unmarked" || sorted.some((r) => (r.byTier.get(t)?.attempts ?? 0) > 0)
  );

  function copyData() {
    const lines = [[teamName, ...tiers.map((t) => `${CONTEST_TIER_LABELS[t]} (M-A)`), "Total (M-A)", "Total FG%"].join("\t")];
    for (const row of sorted) {
      const name = playerLabel(rosterById.get(row.playerId)!);
      lines.push(
        [
          name,
          ...tiers.map((t) => {
            const c = cellOf(row, t);
            return `${c.makes}-${c.attempts}`;
          }),
          `${row.total.makes}-${row.total.attempts}`,
          pct(row.total.makes, row.total.attempts),
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
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">{teamName}</th>
              {tiers.map((t) => (
                <th key={t} className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                  {CONTEST_TIER_LABELS[t]}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total (M-A)</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total FG%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={tiers.length + 3} className="px-3 py-3 text-center text-muted-foreground">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const name = playerLabel(rosterById.get(row.playerId)!);
              return (
                <tr key={row.playerId} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  {tiers.map((t) => {
                    const c = cellOf(row, t);
                    return (
                      <td key={t} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {c.attempts > 0 ? (
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => onOpenClips(`${name} — ${CONTEST_TIER_LABELS[t]}`, c.events)}
                          >
                            {c.makes}-{c.attempts}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => onOpenClips(`${name} — All`, row.total.events)}
                    >
                      {row.total.makes}-{row.total.attempts}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    {pct(row.total.makes, row.total.attempts)}
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
