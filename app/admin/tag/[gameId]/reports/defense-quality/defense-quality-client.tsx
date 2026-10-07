"use client";

import { useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import {
  badEvents,
  computeDefenseQualityRows,
  goodEvents,
  netScore,
  sumDefenseRows,
  type DefenseQualityRow,
} from "./defense-quality-stats";

type Column = { key: string; label: string; group: string; tone: "good" | "bad" | "neutral"; events: (r: DefenseQualityRow) => RawEvent[] };

const COLUMNS: Column[] = [
  { key: "saveMid", label: "Save Mid", group: "Good Defense", tone: "good", events: (r) => r.good["Save Mid"] },
  { key: "goodHelp", label: "Good Help", group: "Good Defense", tone: "good", events: (r) => r.good["Good Help"] },
  { key: "lostMid", label: "Lost Mid", group: "Bad Defense", tone: "bad", events: (r) => r.bad["Lost Mid"] },
  { key: "badHelp", label: "Bad Help", group: "Bad Defense", tone: "bad", events: (r) => r.bad["Bad Help"] },
  { key: "helpGood", label: "Good", group: "Help Defense", tone: "good", events: (r) => r.help.Good },
  { key: "helpNormal", label: "Normal", group: "Help Defense", tone: "neutral", events: (r) => r.help.Normal },
  { key: "helpBad", label: "Bad", group: "Help Defense", tone: "bad", events: (r) => r.help.Bad },
  { key: "boxGood", label: "Сайн", group: "Box out", tone: "good", events: (r) => r.boxoutGood },
  { key: "boxBad", label: "Муу", group: "Box out", tone: "bad", events: (r) => r.boxoutBad },
];
const GROUPS = [...new Set(COLUMNS.map((c) => c.group))].map((group) => ({ group, span: COLUMNS.filter((c) => c.group === group).length }));
const TONE = { good: "text-emerald-600 dark:text-emerald-400", bad: "text-red-600 dark:text-red-400", neutral: "text-foreground" };

export function DefenseQualityClient({
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
  const openClips = (title: string, events: RawEvent[]) => {
    if (events.length) setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  };
  const rosterById = new Map([...homeRoster, ...visitorRoster].map((p) => [p.playerId, p]));
  const sides = [
    { teamId: homeTeamId, teamName: homeTeamName },
    { teamId: visitorTeamId, teamName: visitorTeamName },
  ];

  return (
    <div className="flex flex-col gap-8 text-sm">
      <p className="max-w-3xl text-xs text-muted-foreground">
        Хамгаалагч бүрийн дүгнэлттэй tag-ууд: Good/Bad Defense, Help Defense, Box out. <strong>Нийт</strong> = сайн − муу
        (Help &quot;Normal&quot; тооцогдохгүй). Хамгийн сул тоглогч дээрээ. Тоо дээр дарвал клип нээгдэнэ.
      </p>
      {sides.map((side) => (
        <TeamTable key={side.teamId} teamName={side.teamName} rows={computeDefenseQualityRows(rawEvents, side.teamId)}
          rosterById={rosterById} onOpenClips={openClips} />
      ))}
      {modal && <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />}
    </div>
  );
}

function TeamTable({ teamName, rows, rosterById, onOpenClips }: {
  teamName: string;
  rows: DefenseQualityRow[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  const total = sumDefenseRows(rows);
  const nameOf = (r: DefenseQualityRow) => {
    if (r.playerId === "TOTAL") return "Нийт баг";
    const p = rosterById.get(r.playerId);
    return p ? playerLabel(p) : "Тоглогч";
  };

  function copyData() {
    const header = ["Player", ...COLUMNS.map((c) => `${c.group} ${c.label}`), "Нийт"].join("\t");
    const lines = [...rows, total].map((r) => [nameOf(r), ...COLUMNS.map((c) => String(c.events(r).length)), String(netScore(r))].join("\t"));
    void navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  const cell = (r: DefenseQualityRow, events: RawEvent[], title: string, className: string) => (
    events.length > 0
      ? <button className={`${className} hover:underline`} onClick={() => onOpenClips(`${nameOf(r)} — ${title}`, events)}>{events.length}</button>
      : <span className="text-muted-foreground">-</span>
  );

  const renderRow = (r: DefenseQualityRow, isTotal = false) => {
    const net = netScore(r);
    return (
      <tr key={r.playerId} className={isTotal ? "border-t-2 border-border bg-muted/40 font-semibold" : "border-t border-border/60"}>
        <td className="whitespace-nowrap px-3 py-1.5">{nameOf(r)}</td>
        {COLUMNS.map((c) => (
          <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
            {cell(r, c.events(r), `${c.group} · ${c.label}`, TONE[c.tone])}
          </td>
        ))}
        <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
          <button
            className={`font-semibold hover:underline ${net > 0 ? TONE.good : net < 0 ? TONE.bad : "text-muted-foreground"}`}
            onClick={() => onOpenClips(`${nameOf(r)} — бүх хамгаалалтын tag`, [...badEvents(r), ...goodEvents(r)])}
          >
            {net > 0 ? `+${net}` : net}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{teamName} — Хамгаалалтын чанар</h2>
        <button onClick={copyData} className="flex items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
          <CopyIcon className="size-3.5" />
          Copy Data
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th rowSpan={2} className="whitespace-nowrap px-3 py-2 text-left font-semibold">Тоглогч</th>
              {GROUPS.map((g) => (
                <th key={g.group} colSpan={g.span} className="whitespace-nowrap border-l border-border/60 px-2 py-1.5 text-center font-semibold">{g.group}</th>
              ))}
              <th rowSpan={2} className="whitespace-nowrap border-l border-border/60 px-3 py-2 text-right font-semibold">Нийт</th>
            </tr>
            <tr className="bg-muted/70">
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-muted-foreground">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={COLUMNS.length + 2} className="px-3 py-4 text-center text-muted-foreground">Хамгаалалтын tag бүртгэгдээгүй байна.</td></tr>
            )}
            {rows.map((r) => renderRow(r))}
            {rows.length > 0 && renderRow(total, true)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
