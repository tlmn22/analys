"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { TypeDetailConfig } from "@/lib/tag-events";
import { playerLabel, type RosterPlayer } from "./types";

type Stage = "player" | "second" | "type" | "winner";

/** Shared panel: pick a player, optionally pick a second player (e.g. who
 * set the screen, or the opponent in a physical-contact pair), then pick a
 * type from a list of blue key-badged rows (matching the reference tool's
 * Turnover/Off Foul/Screen Set/Screen Received detail screens), with
 * optional "Alt + X" checkboxes above the list and an optional final
 * "who won?" stage. */
export function TypeDetailPanel({
  eventLabel,
  roster,
  needsPlayer = true,
  secondPlayerRoster,
  config,
  onCancel,
  onDone,
}: {
  eventLabel: string;
  roster: RosterPlayer[];
  /** Team-level events (e.g. Man to Man/Zone) skip the player stage
   * entirely and go straight to the type list. */
  needsPlayer?: boolean;
  /** Resolves the second-player stage's candidate list from the
   * first-picked player. Defaults to "roster minus the first player"
   * (teammates) when omitted — pass this to restrict to e.g. the
   * opponent's on-court 5 instead. */
  secondPlayerRoster?: (player: RosterPlayer) => RosterPlayer[];
  config: TypeDetailConfig;
  onCancel: () => void;
  onDone: (
    player: RosterPlayer | null,
    modifierFields: Record<string, boolean>,
    type: string,
    secondPlayer: RosterPlayer | null,
    winner: RosterPlayer | null
  ) => void;
}) {
  const { modifiers, types, otherLabel, secondPlayerLabel, pickWinner, typeFirst } = config;
  const [stage, setStage] = useState<Stage>(typeFirst ? "type" : needsPlayer ? "player" : "type");
  const [player, setPlayer] = useState<RosterPlayer | null>(null);
  const [secondPlayer, setSecondPlayer] = useState<RosterPlayer | null>(null);
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function pickPlayer(p: RosterPlayer) {
    setPlayer(p);
    if (typeFirst) {
      onDone(p, checked, pickedType as string, secondPlayer, null);
      return;
    }
    setStage(secondPlayerLabel ? "second" : "type");
  }

  function pickSecondPlayer(p: RosterPlayer) {
    setSecondPlayer(p);
    setStage("type");
  }

  function pickType(type: string) {
    if (typeFirst && needsPlayer && !player) {
      setPickedType(type);
      setStage("player");
      return;
    }
    if (pickWinner && secondPlayer) {
      setPickedType(type);
      setStage("winner");
    } else {
      onDone(player, checked, type, secondPlayer, null);
    }
  }

  if (stage === "player") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
        <Button variant="outline" onClick={() => (typeFirst ? setStage("type") : onCancel())}>
          {typeFirst ? "← Back" : "← Cancel"}
        </Button>
        <div className="text-sm font-semibold">
          {pickedType ? `${eventLabel} (${pickedType}): Pick Player` : `${eventLabel}: Pick Player`}
        </div>
        {roster.length === 0 && (
          <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {roster.map((p) => (
            <Button key={p.playerId} variant="outline" className="justify-start" onClick={() => pickPlayer(p)}>
              {playerLabel(p)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "second") {
    const candidates = secondPlayerRoster
      ? secondPlayerRoster(player as RosterPlayer)
      : roster.filter((p) => p.playerId !== player?.playerId);
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
        <Button variant="outline" onClick={() => setStage("player")}>
          ← Back
        </Button>
        <div className="text-sm font-semibold">
          {eventLabel}: {player ? playerLabel(player) : ""} — {secondPlayerLabel}
        </div>
        {candidates.length === 0 && (
          <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {candidates.map((p) => (
            <Button key={p.playerId} variant="outline" className="justify-start" onClick={() => pickSecondPlayer(p)}>
              {playerLabel(p)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === "winner") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold">
            {eventLabel} ({pickedType}): who won?
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            ⊘ Cancel
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {[player, secondPlayer].map(
            (p) =>
              p && (
                <button
                  key={p.playerId}
                  onClick={() => onDone(player, checked, pickedType as string, secondPlayer, p)}
                  className="flex items-stretch overflow-hidden rounded-md text-left"
                >
                  <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white" />
                  <span className="flex-1 bg-blue-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-600">
                    {playerLabel(p)} Won
                  </span>
                </button>
              )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold">
          {player ? `${eventLabel}: ${playerLabel(player)}` : `${eventLabel}:`}
        </div>
        <button
          onClick={onCancel}
          className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
        >
          ⊘ Cancel
        </button>
      </div>

      {modifiers && modifiers.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {modifiers.map((m) => (
            <label key={m.field} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!checked[m.field]}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [m.field]: e.target.checked }))
                }
              />
              {m.label}
              {m.key && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Alt + {m.key}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {types.map((t, i) => (
          <button
            key={`${t.label}-${i}`}
            onClick={() => pickType(t.label)}
            className="flex items-stretch overflow-hidden rounded-md text-left"
          >
            <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white">
              {t.key}
            </span>
            <span className="flex-1 bg-blue-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-600">
              {t.label}
            </span>
          </button>
        ))}
        {otherLabel && (
          <button
            onClick={() => pickType(otherLabel)}
            className="flex items-stretch overflow-hidden rounded-md border border-blue-400"
          >
            <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white">
              ?
            </span>
            <span className="flex-1 bg-background px-3 py-2 text-center text-sm font-medium text-blue-500">
              {otherLabel}
            </span>
          </button>
        )}
        {otherLabel && (
          <button className="rounded-md bg-slate-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-500">
            More Choices...
          </button>
        )}
      </div>
    </div>
  );
}
