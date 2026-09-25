"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  STOPPED,
  OFFENSE,
  DEFENSE,
  OTHER,
  OFFENSE_TEAM_SETS,
  DEFENSE_TEAM_SETS,
  type EventDef,
} from "@/lib/tag-events";
import { SOLID_CLASSES } from "@/lib/tag-colors";

export function ActionPanel({
  live,
  onToggleLive,
  onEventTriggered,
  onShowMoreOther,
}: {
  live: boolean;
  onToggleLive: () => void;
  onEventTriggered: (event: EventDef) => void;
  onShowMoreOther: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const events = live
        ? [...OFFENSE, ...DEFENSE, ...OTHER, ...OFFENSE_TEAM_SETS, ...DEFENSE_TEAM_SETS]
        : STOPPED;
      const match = events.find((ev) => ev.key !== "" && ev.key === e.key);
      if (match) {
        e.preventDefault();
        onEventTriggered(match);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [live, onEventTriggered]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button
        onClick={onToggleLive}
        className={
          live
            ? "bg-red-600 text-white hover:bg-red-500"
            : "bg-orange-600 text-white hover:bg-orange-500"
        }
      >
        {live ? "■ Stop Action" : "▶ Start Action"}
      </Button>

      {!live && (
        <EventSection title="Stopped Clock Events" events={STOPPED} onPick={onEventTriggered} />
      )}
      {live && (
        <>
          <EventSection
            title="Offensive Player Events"
            showMore
            events={OFFENSE}
            onPick={onEventTriggered}
          />
          <EventSection
            title="Defensive Player Events"
            showMore
            events={DEFENSE}
            onPick={onEventTriggered}
          />
          <EventSection
            title="Other Player Events"
            showMore
            events={OTHER}
            onPick={onEventTriggered}
            onShowMore={onShowMoreOther}
          />
          <EventSection title="Offensive Team Sets" events={OFFENSE_TEAM_SETS} onPick={onEventTriggered} />
          <EventSection title="Defensive Team Sets" events={DEFENSE_TEAM_SETS} onPick={onEventTriggered} />
        </>
      )}
    </div>
  );
}

function EventSection({
  title,
  events,
  onPick,
  showMore,
  onShowMore,
}: {
  title: string;
  events: EventDef[];
  onPick: (e: EventDef) => void;
  showMore?: boolean;
  onShowMore?: () => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {showMore &&
          (onShowMore ? (
            <button
              onClick={onShowMore}
              className="cursor-pointer text-xs text-blue-500 hover:underline"
            >
              (show more)
            </button>
          ) : (
            <span className="cursor-default text-xs text-blue-500">(show more)</span>
          ))}
      </div>
      {events.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {events.map((ev) => (
            <button
              key={ev.type}
              onClick={() => onPick(ev)}
              className={`relative rounded-md px-2.5 py-2 text-left text-sm font-semibold transition-colors ${SOLID_CLASSES[ev.color]}`}
            >
              {ev.label}
              {ev.key && (
                <span className="absolute right-1.5 top-1 font-mono text-[9px] text-white/70">
                  {ev.key}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
