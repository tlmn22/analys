"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { playerLabel, type RosterPlayer } from "./types";

export function PlayerPickerPanel({
  title,
  roster,
  onCancel,
  onDone,
  freeThrow = false,
  finalFreeThrow = false,
}: {
  title: string;
  roster: RosterPlayer[];
  onCancel: () => void;
  onDone: (player: RosterPlayer, lastFreeThrow?: boolean) => void;
  freeThrow?: boolean;
  finalFreeThrow?: boolean;
}) {
  const [lastFreeThrow, setLastFreeThrow] = useState(finalFreeThrow);
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={onCancel}>
        ← Cancel
      </Button>
      <div className="text-sm font-semibold">{title}</div>
      {freeThrow && <label className="text-sm"><input type="checkbox" checked={lastFreeThrow} onChange={e => setLastFreeThrow(e.target.checked)} /> Сүүлийн торгуулийн шидэлт</label>}
      {roster.length === 0 && (
        <p className="text-sm text-muted-foreground">Roster хоосон байна.</p>
      )}
      <div className="flex flex-col gap-1.5">
        {roster.map((p) => (
          <Button key={p.playerId} variant="outline" className="justify-start" onClick={() => onDone(p, freeThrow && lastFreeThrow)}>
            {playerLabel(p)}
          </Button>
        ))}
      </div>
    </div>
  );
}
