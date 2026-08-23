"use client";

import { Button } from "@/components/ui/button";
import type { EventDef } from "@/lib/tag-events";
import { SOLID_CLASSES } from "@/lib/tag-colors";

export function MoreEventsPanel({
  title,
  events,
  onCancel,
  onPick,
}: {
  title: string;
  events: EventDef[];
  onCancel: () => void;
  onPick: (event: EventDef) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex flex-col gap-1">
        {events.map((ev) => (
          <button
            key={ev.type}
            onClick={() => onPick(ev)}
            className="flex items-stretch overflow-hidden rounded-md text-left"
          >
            <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white">
              {ev.key}
            </span>
            <span
              className={`flex-1 px-3 py-2 text-center text-sm font-medium ${SOLID_CLASSES[ev.color]}`}
            >
              {ev.label}
            </span>
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        className="border-red-400 text-red-500 hover:bg-red-500/10"
        onClick={onCancel}
      >
        ⊘ Cancel
      </Button>
    </div>
  );
}
