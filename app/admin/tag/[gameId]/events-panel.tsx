"use client";

import { PencilIcon, StarIcon } from "lucide-react";
import { PILL_CLASSES } from "@/lib/tag-colors";
import { fmtClock } from "./video-panel";
import type { TaggedEvent } from "./types";

export function EventsPanel({
  events,
  onSeek,
  onEdit,
}: {
  events: TaggedEvent[];
  onSeek: (videoTime: number) => void;
  onEdit: (event: TaggedEvent) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <span>Events</span>
        <span className="font-mono font-medium">{events.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-stretch border-b border-border/60 hover:bg-muted/50">
            <button onClick={() => onSeek(e.videoTime)} className="min-w-0 flex-1 px-3 py-2 text-left text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-blue-500">
                  Q{e.period} {fmtClock(e.clockTime)}
                </span>
                {e.keyEvent && <StarIcon className="size-3 shrink-0 fill-yellow-400 text-yellow-400" />}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PILL_CLASSES[e.color]}`}
                >
                  {e.label}
                  {e.shotType && ` (${e.shotType})`}
                  {e.assistType && ` (${e.assistType})`}
                  {e.turnoverType && ` (${e.turnoverType})`}
                  {e.foulType && ` (${e.foulType})`}
                  {e.screenSetType && ` (${e.screenSetType})`}
                  {e.screenRcvdType && ` (${e.screenRcvdType})`}
                  {e.hustlePlayType && ` (${e.hustlePlayType})`}
                  {e.setOffenseName && ` (${e.setOffenseName})`}
                  {e.blobPlayName && ` (${e.blobPlayName}${e.blobOutcome ? ` — ${e.blobOutcome}` : ""})`}
                  {e.slobPlayName && ` (${e.slobPlayName}${e.slobOutcome ? ` — ${e.slobOutcome}` : ""})`}
                  {e.manToManType && ` (${e.manToManType})`}
                  {e.zoneType && ` (${e.zoneType})`}
                  {e.offActionType && ` (${e.offActionType})`}
                  {e.defCoverageType && ` (${e.defCoverageType})`}
                  {e.defOffballType && ` (${e.defOffballType})`}
                  {e.physicalContactType && ` (${e.physicalContactType})`}
                </span>
              </div>
              {e.playerLabel && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {e.playerLabel}
                  {e.assistPlayerLabel && `  (ast: ${e.assistPlayerLabel})`}
                  {e.defenderLabel && `  (def: ${e.defenderLabel})`}
                  {e.screenerLabel && `  (screener: ${e.screenerLabel})`}
                  {e.physicalContactSecondLabel && `  vs ${e.physicalContactSecondLabel}`}
                  {e.physicalContactWinnerLabel && `  (won: ${e.physicalContactWinnerLabel})`}
                </div>
              )}
            </button>
            <button
              onClick={() => onEdit(e)}
              title="Edit event"
              className="flex shrink-0 items-center justify-center px-2 text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
