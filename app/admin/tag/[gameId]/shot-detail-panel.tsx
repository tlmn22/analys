"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SHOT_MODIFIERS, SHOT_TYPES_2PT, SHOT_TYPES_3PT } from "@/lib/tag-events";
import { HalfCourtDiagram } from "./half-court-diagram";
import { playerLabel, type RosterPlayer, type ShotDetails } from "./types";

type Stage = "player" | "detail" | "location" | "assisted" | "assist_player" | "defender";

const emptyModifiers = (): Record<string, boolean> =>
  Object.fromEntries(SHOT_MODIFIERS.map((m) => [m.field, false]));

export function ShotDetailPanel({
  title,
  roster,
  defenderRoster,
  isThreePoint,
  isMade,
  onCancel,
  onDone,
}: {
  title: string;
  roster: RosterPlayer[];
  defenderRoster: RosterPlayer[];
  isThreePoint: boolean;
  /** Only made shots (2pt_made/3pt_made) can be assisted — misses skip the
   * Assisted? stage entirely and go straight from location to defender. */
  isMade: boolean;
  onCancel: () => void;
  onDone: (
    player: RosterPlayer,
    details: ShotDetails,
    defender: RosterPlayer | null,
    assistPlayer: RosterPlayer | null
  ) => void;
}) {
  const [stage, setStage] = useState<Stage>("player");
  const [player, setPlayer] = useState<RosterPlayer | null>(null);
  const [modifiers, setModifiers] = useState<Record<string, boolean>>(emptyModifiers());
  const [shotQuality, setShotQuality] = useState("");
  const [shotType, setShotType] = useState<string | null>(null);
  const [shotX, setShotX] = useState<number | null>(null);
  const [shotY, setShotY] = useState<number | null>(null);
  const [assistPlayer, setAssistPlayer] = useState<RosterPlayer | null>(null);

  function pickPlayer(p: RosterPlayer) {
    setPlayer(p);
    setStage("detail");
  }

  function pickShotType(type: string) {
    setShotType(type);
    setStage("location");
  }

  function pickLocation(x: number | null, y: number | null) {
    setShotX(x);
    setShotY(y);
    setStage(isMade ? "assisted" : "defender");
  }

  function pickAssisted(assisted: boolean) {
    if (assisted) {
      setStage("assist_player");
    } else {
      setAssistPlayer(null);
      setStage("defender");
    }
  }

  function pickAssistPlayer(p: RosterPlayer) {
    setAssistPlayer(p);
    setStage("defender");
  }

  function finish(defender: RosterPlayer | null) {
    const parsedQuality = parseInt(shotQuality, 10);
    const quality = Number.isFinite(parsedQuality)
      ? Math.min(10, Math.max(1, parsedQuality))
      : null;
    onDone(
      player as RosterPlayer,
      {
        andOne: !!modifiers.andOne,
        badMiss: !!modifiers.badMiss,
        contestedClose: !!modifiers.contestedClose,
        lateClock: !!modifiers.lateClock,
        lightlyContested: !!modifiers.lightlyContested,
        uncontested: !!modifiers.uncontested,
        wideOpen: !!modifiers.wideOpen,
        shotQuality: quality,
        shotType: shotType ?? "",
        shotX,
        shotY,
      },
      defender,
      assistPlayer
    );
  }

  function back() {
    if (stage === "defender") setStage(isMade ? "assisted" : "location");
    else if (stage === "assist_player") setStage("assisted");
    else if (stage === "assisted") setStage("location");
    else if (stage === "location") setStage("detail");
    else if (stage === "detail") setStage("player");
    else onCancel();
  }

  const shotTypes = isThreePoint ? SHOT_TYPES_3PT : SHOT_TYPES_2PT;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={back}>
        ← {stage === "player" ? "Cancel" : "Back"}
      </Button>

      {stage === "player" && (
        <>
          <div className="text-sm font-semibold">{title}: Pick Player</div>
          {roster.length === 0 && (
            <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {roster.map((p) => (
              <Button key={p.playerId} variant="outline" onClick={() => pickPlayer(p)}>
                {playerLabel(p)}
              </Button>
            ))}
          </div>
        </>
      )}

      {stage === "detail" && player && (
        <>
          <div className="text-sm font-semibold">
            {title}: {playerLabel(player)}
          </div>
          <div className="flex flex-col gap-1.5">
            {SHOT_MODIFIERS.map((m) => (
              <label key={m.field} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!modifiers[m.field]}
                  onChange={(e) =>
                    setModifiers((prev) => ({ ...prev, [m.field]: e.target.checked }))
                  }
                />
                {m.label}
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm">Shot Quality (1-10):</span>
            <Input
              type="number"
              min={1}
              max={10}
              value={shotQuality}
              onChange={(e) => setShotQuality(e.target.value)}
              className="h-8 w-16"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {shotTypes.map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => pickShotType(t)}>
                {t}
              </Button>
            ))}
          </div>
        </>
      )}

      {stage === "location" && player && (
        <>
          <div className="text-sm font-semibold">
            {title} ({shotType}) by {playerLabel(player)} — click location
          </div>
          <HalfCourtDiagram onPick={(x, y) => pickLocation(x, y)} />
          <Button variant="secondary" onClick={() => pickLocation(null, null)}>
            No Location
          </Button>
        </>
      )}

      {stage === "assisted" && player && (
        <>
          <div className="text-sm font-semibold">
            {title}: {playerLabel(player)}
          </div>
          <div className="text-sm text-muted-foreground">Assisted?</div>
          <div className="flex gap-2">
            <button
              onClick={() => pickAssisted(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500"
            >
              Yes
              <span className="rounded bg-black/20 px-1 text-[10px]">y</span>
            </button>
            <button
              onClick={() => pickAssisted(false)}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
            >
              No
              <span className="rounded bg-black/20 px-1 text-[10px]">n</span>
            </button>
          </div>
        </>
      )}

      {stage === "assist_player" && player && (
        <>
          <div className="text-sm font-semibold">
            {title}: {playerLabel(player)} — who assisted?
          </div>
          <div className="flex flex-col gap-1.5">
            {roster
              .filter((p) => p.playerId !== player.playerId)
              .map((p) => (
                <Button key={p.playerId} variant="outline" onClick={() => pickAssistPlayer(p)}>
                  {playerLabel(p)}
                </Button>
              ))}
          </div>
        </>
      )}

      {stage === "defender" && player && (
        <>
          <div className="text-sm font-semibold">
            {title} by {playerLabel(player)} — who was defending?
          </div>
          {defenderRoster.length === 0 && (
            <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {defenderRoster.map((p) => (
              <Button key={p.playerId} variant="outline" onClick={() => finish(p)}>
                {playerLabel(p)}
              </Button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => finish(null)}>
            No Defender
          </Button>
        </>
      )}
    </div>
  );
}
