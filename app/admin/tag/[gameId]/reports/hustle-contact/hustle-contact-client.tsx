"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { computeHustleRows, computeContactRows, PHYSICAL_CONTACT_TYPES, type HustleRow, type ContactRow } from "./hustle-contact-stats";

const HUSTLE_COLUMNS: { key: keyof HustleRow; label: string }[] = [
  { key: "diving", label: "Diving for Ball" },
  { key: "orebEffort", label: "Off Reb Effort" },
  { key: "drebEffort", label: "Def Reb Effort" },
  { key: "goodBump", label: "Good Bump" },
  { key: "other", label: "Other" },
];

function winPct(wins: number, losses: number): string {
  const total = wins + losses;
  return total > 0 ? `${Math.round((wins / total) * 100)}%` : "-";
}

export function HustleContactClient({
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
      <section>
        <h2 className="mb-3 text-lg font-semibold">Hustle Plays</h2>
        <div className="flex flex-col gap-6">
          {sides.map((side) => {
            const rows = computeHustleRows(rawEvents, side.teamId, side.roster.map((p) => p.playerId));
            return (
              <HustleTable
                key={side.teamId}
                title={`${side.teamName} Hustle Plays`}
                rows={rows}
                rosterById={rosterById}
                onOpenClips={openClips}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Physical Contact</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Every contact event names both players — a win for one side is a loss for the other, so each player&apos;s
          row reflects every battle they were part of, whichever side tagged it.
        </p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => {
            const rows = computeContactRows(rawEvents, side.teamId, side.roster.map((p) => p.playerId));
            return (
              <ContactTable
                key={side.teamId}
                title={`${side.teamName} Physical Contact`}
                rows={rows}
                rosterById={rosterById}
                onOpenClips={openClips}
              />
            );
          })}
        </div>
      </section>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function HustleTable({
  title,
  rows,
  rosterById,
  onOpenClips,
}: {
  title: string;
  rows: HustleRow[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  function copyData() {
    const lines = [["Player", ...HUSTLE_COLUMNS.map((c) => c.label), "Total"].join("\t")];
    for (const row of rows) {
      const name = playerLabel(rosterById.get(row.playerId)!);
      lines.push(
        [name, ...HUSTLE_COLUMNS.map((c) => String((row[c.key] as RawEvent[]).length)), String(row.total.length)].join(
          "\t"
        )
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
              {HUSTLE_COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={HUSTLE_COLUMNS.length + 2} className="px-3 py-3 text-center text-muted-foreground">
                  Hustle play бүртгэгдээгүй байна.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const name = playerLabel(rosterById.get(row.playerId)!);
              return (
                <tr key={row.playerId} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  {HUSTLE_COLUMNS.map((c) => {
                    const events = row[c.key] as RawEvent[];
                    return (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {events.length > 0 ? (
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => onOpenClips(`${name} — ${c.label}`, events)}
                          >
                            {events.length}
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
                      onClick={() => onOpenClips(`${name} — All Hustle Plays`, row.total)}
                    >
                      {row.total.length}
                    </button>
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

function ContactTable({
  title,
  rows,
  rosterById,
  onOpenClips,
}: {
  title: string;
  rows: ContactRow[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  function cellEvents(row: ContactRow, type: string): RawEvent[] {
    const cell = row.byType.get(type);
    return cell ? [...cell.wins, ...cell.losses] : [];
  }

  function copyData() {
    const lines = [["Player", ...PHYSICAL_CONTACT_TYPES.map((t) => t.label), "Total W-L", "Win %"].join("\t")];
    for (const row of rows) {
      const name = playerLabel(rosterById.get(row.playerId)!);
      const cells = PHYSICAL_CONTACT_TYPES.map((t) => {
        const c = row.byType.get(t.label);
        return c ? `${c.wins.length}-${c.losses.length}` : "-";
      });
      lines.push(
        [
          name,
          ...cells,
          `${row.total.wins.length}-${row.total.losses.length}`,
          winPct(row.total.wins.length, row.total.losses.length),
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
              {PHYSICAL_CONTACT_TYPES.map((t) => (
                <th key={t.label} className="whitespace-nowrap px-2 py-2 text-center font-semibold">
                  {t.label}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">Total (W-L)</th>
              <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={PHYSICAL_CONTACT_TYPES.length + 3} className="px-3 py-3 text-center text-muted-foreground">
                  Physical contact бүртгэгдээгүй байна.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const name = playerLabel(rosterById.get(row.playerId)!);
              return (
                <tr key={row.playerId} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  {PHYSICAL_CONTACT_TYPES.map((t) => {
                    const cell = row.byType.get(t.label);
                    const events = cellEvents(row, t.label);
                    return (
                      <td key={t.label} className="whitespace-nowrap px-2 py-1.5 text-center">
                        {cell ? (
                          <button
                            className="text-blue-500 hover:underline"
                            onClick={() => onOpenClips(`${name} — ${t.label}`, events)}
                          >
                            {cell.wins.length}-{cell.losses.length}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-semibold">
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => onOpenClips(`${name} — All Physical Contact`, [...row.total.wins, ...row.total.losses])}
                    >
                      {row.total.wins.length}-{row.total.losses.length}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-semibold">
                    {winPct(row.total.wins.length, row.total.losses.length)}
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
