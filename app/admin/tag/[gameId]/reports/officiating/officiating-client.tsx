"use client";

import { useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { computeFoulCallRows, sumRows, cellAt, CALL_QUALITIES, type FoulTypeRow } from "./foul-call-stats";

function pct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : "-";
}

const QUALITY_COLORS: Record<string, string> = {
  "Bad Call": "text-red-600 dark:text-red-400",
  "Correct Call": "text-emerald-600 dark:text-emerald-400",
  "50-50": "text-amber-600 dark:text-amber-400",
  Unmarked: "text-muted-foreground",
};

export function OfficiatingClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  rawEvents,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  rawEvents: RawEvent[];
}) {
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  function openClips(title: string, events: RawEvent[]) {
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  const sides = [
    { teamId: homeTeamId, teamName: homeTeamName },
    { teamId: visitorTeamId, teamName: visitorTeamName },
  ];

  return (
    <div className="flex flex-col gap-10 text-sm">
      <p className="text-xs text-muted-foreground">
        Every Off Foul / Def Foul, by the call-quality checkbox tagged with it (Bad Call/Correct Call/50-50) — rows
        are fouls whistled AGAINST that team, so a high Bad Call count means that team was on the wrong end of bad
        officiating.
      </p>
      <div className="flex flex-col gap-8">
        {sides.map((side) => (
          <FoulCallTable
            key={side.teamId}
            title={`Fouls Called Against ${side.teamName}`}
            rows={computeFoulCallRows(rawEvents, side.teamId)}
            onOpenClips={openClips}
          />
        ))}
      </div>

      {modal && (
        <ClipModal title={modal.title} videoUrl={videoUrl} clips={modal.clips} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function FoulCallTable({
  title,
  rows,
  onOpenClips,
}: {
  title: string;
  rows: FoulTypeRow[];
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  const total = sumRows(rows);
  const badCalls = cellAt(total, "Bad Call").count;

  function copyData() {
    const lines = [["Foul Type", ...CALL_QUALITIES, "Total"].join("\t")];
    for (const row of rows) {
      lines.push([row.label, ...CALL_QUALITIES.map((q) => String(cellAt(row, q).count)), String(row.total.count)].join("\t"));
    }
    lines.push(
      ["TOTAL", ...CALL_QUALITIES.map((q) => String(cellAt(total, q).count)), String(total.total.count)].join("\t")
    );
    navigator.clipboard.writeText(lines.join("\n"));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <button onClick={copyData} className="flex items-center gap-1.5 text-xs italic text-blue-500 hover:underline">
          <CopyIcon className="size-3.5" />
          Copy Data
        </button>
        <p className="text-xs text-muted-foreground">
          {total.total.count} fouls total —{" "}
          <span className={QUALITY_COLORS["Bad Call"]}>
            {badCalls} Bad Call{badCalls === 1 ? "" : "s"} ({pct(badCalls, total.total.count)})
          </span>
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted">
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">{title}</th>
              {CALL_QUALITIES.map((q) => (
                <th key={q} className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${QUALITY_COLORS[q]}`}>
                  {q}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={CALL_QUALITIES.length + 2} className="px-3 py-3 text-center text-muted-foreground">
                  Зөрчил тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border/60">
                <td className="whitespace-nowrap px-3 py-1.5">{row.label}</td>
                {CALL_QUALITIES.map((q) => {
                  const c = cellAt(row, q);
                  return (
                    <td key={q} className="whitespace-nowrap px-2 py-1.5 text-right">
                      {c.count > 0 ? (
                        <button
                          className="text-blue-500 hover:underline"
                          onClick={() => onOpenClips(`${row.label} — ${q}`, c.events)}
                        >
                          {c.count}
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
                    onClick={() => onOpenClips(row.label, row.total.events)}
                  >
                    {row.total.count}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                <td className="px-3 py-1.5">TOTAL</td>
                {CALL_QUALITIES.map((q) => {
                  const c = cellAt(total, q);
                  return (
                    <td key={q} className="whitespace-nowrap px-2 py-1.5 text-right">
                      {c.count > 0 ? (
                        <button
                          className="text-blue-500 hover:underline"
                          onClick={() => onOpenClips(`${title} — ${q}`, c.events)}
                        >
                          {c.count}
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  <button
                    className="text-blue-500 hover:underline"
                    onClick={() => onOpenClips(title, total.total.events)}
                  >
                    {total.total.count}
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
