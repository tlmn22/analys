"use client";

import { useMemo, useState } from "react";
import { CopyIcon } from "lucide-react";
import type { RawEvent } from "../game-summary/summary-stats";
import { computePossessions } from "../game-summary/pace-stats";
import { playerLabel, type RosterPlayer } from "../../types";
import { ClipModal } from "../clip-modal";
import { buildClipEvents, type ClipEvent } from "../clip-events";
import { OFFENSE_ACTION_TYPES, DEF_COVERAGE_TYPES, DEF_OFFBALL_TYPES } from "@/lib/tag-events";
import {
  computeScreenSetterRows,
  computeScreenUsageRows,
  computeScreenCombos,
  computeActionRows,
  type CountRow,
  type ScreenCombo,
  type ActionCategoryTotals,
} from "./screen-stats";

function pct(m: number, a: number): string {
  return a > 0 ? `${Math.round((m / a) * 100)}%` : "-";
}

export function ScreensClient({
  videoUrl,
  homeTeamId,
  visitorTeamId,
  homeTeamName,
  visitorTeamName,
  homeRoster,
  visitorRoster,
  rawEvents,
  maxSeconds,
}: {
  videoUrl: string;
  homeTeamId: string;
  visitorTeamId: string;
  homeTeamName: string;
  visitorTeamName: string;
  homeRoster: RosterPlayer[];
  visitorRoster: RosterPlayer[];
  rawEvents: RawEvent[];
  maxSeconds: number;
}) {
  const [modal, setModal] = useState<{ title: string; clips: ClipEvent[] } | null>(null);

  function openClips(title: string, events: RawEvent[]) {
    setModal({ title, clips: buildClipEvents(events, homeTeamId, visitorTeamId) });
  }

  const rosterById = useMemo(
    () => new Map([...homeRoster, ...visitorRoster].map((p) => [p.playerId, p])),
    [homeRoster, visitorRoster]
  );

  const possessions = useMemo(
    () => computePossessions(rawEvents, homeTeamId, visitorTeamId),
    [rawEvents, homeTeamId, visitorTeamId]
  );

  const sides = [
    { teamId: homeTeamId, opponentId: visitorTeamId, teamName: homeTeamName, roster: homeRoster },
    { teamId: visitorTeamId, opponentId: homeTeamId, teamName: visitorTeamName, roster: visitorRoster },
  ];

  return (
    <div className="flex flex-col gap-10 text-sm">
      <section>
        <h2 className="mb-1 text-lg font-semibold">Offensive Actions (PnR / Screens)</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Points/FG/TO are the result of whichever possession the action was tagged in — a possession with more than
          one action tag credits all of them.
        </p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => {
            const totals = computeActionRows(
              rawEvents,
              side.teamId,
              side.opponentId,
              "offense",
              "off_action",
              (e) => e.offActionType ?? null,
              possessions,
              0,
              maxSeconds
            );
            return (
              <ActionTable
                key={side.teamId}
                title={`${side.teamName} — Actions`}
                knownTypes={OFFENSE_ACTION_TYPES.map((t) => t.label)}
                totals={totals}
                pointsLabel="Points"
                onOpenClips={openClips}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Defensive PnR Coverage</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Points/FG/TO are the opponent&apos;s result on the possession the coverage was called on — read as
          &quot;allowed while in this coverage.&quot;
        </p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => {
            const totals = computeActionRows(
              rawEvents,
              side.teamId,
              side.opponentId,
              "defense",
              "def_coverage",
              (e) => e.defCoverageType ?? null,
              possessions,
              0,
              maxSeconds
            );
            return (
              <ActionTable
                key={side.teamId}
                title={`${side.teamName} — PnR Coverage`}
                knownTypes={DEF_COVERAGE_TYPES.map((t) => t.label)}
                totals={totals}
                pointsLabel="Pts Allowed"
                onOpenClips={openClips}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Off-Ball Screen Defense</h2>
        <div className="flex flex-col gap-6">
          {sides.map((side) => {
            const totals = computeActionRows(
              rawEvents,
              side.teamId,
              side.opponentId,
              "defense",
              "def_offball",
              (e) => e.defOffballType ?? null,
              possessions,
              0,
              maxSeconds
            );
            return (
              <ActionTable
                key={side.teamId}
                title={`${side.teamName} — Off-Ball D`}
                knownTypes={DEF_OFFBALL_TYPES.map((t) => t.label)}
                totals={totals}
                pointsLabel="Pts Allowed"
                onOpenClips={openClips}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Screen Setters</h2>
        <div className="flex flex-col gap-6">
          {sides.map((side) => (
            <CountTable
              key={side.teamId}
              title={`${side.teamName} — Screen Setters`}
              rows={computeScreenSetterRows(rawEvents, side.teamId, side.roster.map((p) => p.playerId))}
              columns={["DHO", "Handoff", "Pop", "Rescreen", "Roll", "Stay"]}
              rosterById={rosterById}
              onOpenClips={openClips}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Screen Usage (Ball Handlers)</h2>
        <div className="flex flex-col gap-6">
          {sides.map((side) => (
            <CountTable
              key={side.teamId}
              title={`${side.teamName} — Screen Usage`}
              rows={computeScreenUsageRows(rawEvents, side.teamId, side.roster.map((p) => p.playerId))}
              columns={["Reject", "Use"]}
              rosterById={rosterById}
              onOpenClips={openClips}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Top Screening Combos</h2>
        <p className="mb-3 text-xs text-muted-foreground">Screener + ball-handler pairs, most screens together first.</p>
        <div className="flex flex-col gap-6">
          {sides.map((side) => (
            <ComboTable
              key={side.teamId}
              title={`${side.teamName} — Screening Combos`}
              combos={computeScreenCombos(rawEvents, side.teamId)}
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

function ActionTable({
  title,
  knownTypes,
  totals,
  pointsLabel,
  onOpenClips,
}: {
  title: string;
  knownTypes: string[];
  totals: Map<string, ActionCategoryTotals>;
  pointsLabel: string;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  const rows = knownTypes.map((t) => totals.get(t)).filter((r): r is ActionCategoryTotals => !!r && r.count > 0);

  function copyData() {
    const lines = [["Category", "Count", pointsLabel, "PPP", "FG", "FG%", "TO"].join("\t")];
    for (const r of rows) {
      lines.push(
        [
          r.category,
          String(r.count),
          String(r.points),
          (r.count > 0 ? r.points / r.count : 0).toFixed(2),
          `${r.fgm}/${r.fga}`,
          pct(r.fgm, r.fga),
          String(r.to),
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
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Count</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">{pointsLabel}</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">PPP</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">FG</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">FG%</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">TO</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center text-muted-foreground">
                  Тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.category} className="border-t border-border/60">
                <td className="whitespace-nowrap px-3 py-1.5">{r.category}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${title} — ${r.category}`, r.tagEvents)}>
                    {r.count}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  <button
                    className="text-blue-500 hover:underline"
                    onClick={() => onOpenClips(`${title} — ${r.category} (${pointsLabel})`, r.outcomeEvents)}
                  >
                    {r.points}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{(r.count > 0 ? r.points / r.count : 0).toFixed(2)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {r.fga > 0 ? (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() =>
                        onOpenClips(
                          `${title} — ${r.category} (FG)`,
                          r.outcomeEvents.filter((e) => e.eventType.includes("pt_"))
                        )
                      }
                    >
                      {r.fgm}/{r.fga}
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{pct(r.fgm, r.fga)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">
                  {r.to > 0 ? (
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() =>
                        onOpenClips(
                          `${title} — ${r.category} (TO)`,
                          r.outcomeEvents.filter((e) => e.eventType === "turnover")
                        )
                      }
                    >
                      {r.to}
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountTable({
  title,
  rows,
  columns,
  rosterById,
  onOpenClips,
}: {
  title: string;
  rows: CountRow[];
  columns: string[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  function copyData() {
    const lines = [["Player", ...columns, "Other", "Total"].join("\t")];
    for (const row of rows) {
      const name = playerLabel(rosterById.get(row.playerId)!);
      const cells = columns.map((c) => String((row.byType.get(c) ?? []).length));
      lines.push([name, ...cells, String(row.other.length), String(row.total.length)].join("\t"));
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
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                  {c}
                </th>
              ))}
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Other</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="px-3 py-3 text-center text-muted-foreground">
                  Тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const name = playerLabel(rosterById.get(row.playerId)!);
              return (
                <tr key={row.playerId} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{name}</td>
                  {columns.map((c) => {
                    const evs = row.byType.get(c) ?? [];
                    return (
                      <td key={c} className="whitespace-nowrap px-2 py-1.5 text-right">
                        {evs.length > 0 ? (
                          <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${name} — ${c}`, evs)}>
                            {evs.length}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {row.other.length > 0 ? (
                      <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${name} — Other`, row.other)}>
                        {row.other.length}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    <button className="text-blue-500 hover:underline" onClick={() => onOpenClips(`${name} — Total`, row.total)}>
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

function ComboTable({
  title,
  combos,
  rosterById,
  onOpenClips,
}: {
  title: string;
  combos: ScreenCombo[];
  rosterById: Map<string, RosterPlayer>;
  onOpenClips: (title: string, events: RawEvent[]) => void;
}) {
  function copyData() {
    const lines = [["Screener", "Ball Handler", "Screens", "Used", "Rejected"].join("\t")];
    for (const c of combos) {
      const screener = rosterById.get(c.screenerId);
      const handler = rosterById.get(c.ballHandlerId);
      if (!screener || !handler) continue;
      lines.push(
        [playerLabel(screener), playerLabel(handler), String(c.events.length), String(c.use.length), String(c.reject.length)].join(
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
              <th className="whitespace-nowrap px-3 py-2 text-left font-semibold">Ball Handler</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Screens</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Used</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {combos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-3 text-center text-muted-foreground">
                  Тэмдэглэгдээгүй байна.
                </td>
              </tr>
            )}
            {combos.map((c) => {
              const screener = rosterById.get(c.screenerId);
              const handler = rosterById.get(c.ballHandlerId);
              if (!screener || !handler) return null;
              return (
                <tr key={`${c.screenerId}:${c.ballHandlerId}`} className="border-t border-border/60">
                  <td className="whitespace-nowrap px-3 py-1.5">{playerLabel(screener)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{playerLabel(handler)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={() => onOpenClips(`${playerLabel(screener)} → ${playerLabel(handler)}`, c.events)}
                    >
                      {c.events.length}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {c.use.length > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onOpenClips(`${playerLabel(screener)} → ${playerLabel(handler)} (Used)`, c.use)}
                      >
                        {c.use.length}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    {c.reject.length > 0 ? (
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => onOpenClips(`${playerLabel(screener)} → ${playerLabel(handler)} (Rejected)`, c.reject)}
                      >
                        {c.reject.length}
                      </button>
                    ) : (
                      "-"
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
