"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playerLabel, type RosterPlayer } from "./types";

/** Turnover types a steal can force — optional, one tap. */
export const STEAL_TURNOVER_TYPES = ["Pass Bad", "Dribble Lost", "Takeaway"];

/** Steal: pick the defender who stole it, then the offensive player who
 * lost the ball (saved as their Turnover). A steal is always someone's
 * turnover; Skip saves the steal alone when it's unclear who. */
export function StealPanel({
  defenders,
  attackers,
  onCancel,
  onDone,
}: {
  defenders: RosterPlayer[];
  attackers: RosterPlayer[];
  onCancel: () => void;
  onDone: (stealer: RosterPlayer, loser: RosterPlayer | null, turnoverType: string | null) => void;
}) {
  const [stealer, setStealer] = useState<RosterPlayer | null>(null);
  const [turnoverType, setTurnoverType] = useState<string | null>(null);

  if (!stealer) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
        <Button variant="outline" onClick={onCancel}>← Cancel</Button>
        <div className="text-sm font-semibold">Steal — хэн булааж авсан бэ?</div>
        {defenders.length === 0 && <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>}
        <div className="flex flex-col gap-1.5">
          {defenders.map((p) => (
            <Button key={p.playerId} variant="outline" className="justify-start" onClick={() => setStealer(p)}>
              {playerLabel(p)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={() => setStealer(null)}>← Back</Button>
      <div className="text-sm font-semibold">Steal: {playerLabel(stealer)} — хэн бөмбөг алдсан бэ? (Turnover)</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Turnover төрөл (заавал биш)">
        {STEAL_TURNOVER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={turnoverType === type}
            onClick={() => setTurnoverType(turnoverType === type ? null : type)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              turnoverType === type ? "border-blue-500 bg-blue-500 text-white" : "hover:bg-muted"
            )}
          >
            {type}
          </button>
        ))}
      </div>
      {attackers.length === 0 && <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>}
      <div className="flex flex-col gap-1.5">
        {attackers.map((p) => (
          <Button key={p.playerId} variant="outline" className="justify-start" onClick={() => onDone(stealer, p, turnoverType)}>
            {playerLabel(p)}
          </Button>
        ))}
      </div>
      <Button variant="secondary" onClick={() => onDone(stealer, null, null)}>Алгасах (зөвхөн Steal)</Button>
    </div>
  );
}
