"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TypeOption } from "@/lib/tag-events";

type Stage = "name" | "outcome";

/** Growable per-game play-name panel (Set Offense/BLOB/SLOB aren't a fixed
 * taxonomy — every team calls different named plays, so the list is built
 * up per-game via "Other X"). When `outcomes` is set, picking a name is
 * followed by a "what happened?" stage (BLOB/SLOB success-rate tracking). */
export function PlayNamePanel({
  title,
  names,
  outcomes,
  onCancel,
  onDone,
}: {
  title: string;
  names: string[];
  outcomes?: TypeOption[];
  onCancel: () => void;
  onDone: (name: string, outcome: string | null) => void;
}) {
  const [stage, setStage] = useState<Stage>("name");
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  function pickName(name: string) {
    if (outcomes && outcomes.length > 0) {
      setPickedName(name);
      setStage("outcome");
    } else {
      onDone(name, null);
    }
  }

  function submitNew() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName("");
    setAdding(false);
    pickName(trimmed);
  }

  if (stage === "outcome" && outcomes) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold">
            {title} ({pickedName}): Outcome?
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            ⊘ Cancel
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {outcomes.map((o) => (
            <button
              key={o.label}
              onClick={() => onDone(pickedName as string, o.label)}
              className="flex items-stretch overflow-hidden rounded-md text-left"
            >
              <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white">
                {o.key}
              </span>
              <span className="flex-1 bg-blue-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-600">
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold">{title}:</div>
        <button
          onClick={onCancel}
          className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
        >
          ⊘ Cancel
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {names.map((name) => (
          <button
            key={name}
            onClick={() => pickName(name)}
            className="flex items-stretch overflow-hidden rounded-md text-left"
          >
            <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white" />
            <span className="flex-1 bg-blue-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-600">
              {name}
            </span>
          </button>
        ))}

        {adding ? (
          <div className="flex items-stretch gap-1.5">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNew()}
              placeholder="Set name..."
              className="h-9 flex-1"
            />
            <Button size="sm" onClick={submitNew}>
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-stretch overflow-hidden rounded-md border border-blue-400"
          >
            <span className="flex w-7 shrink-0 items-center justify-center bg-slate-800 text-[10px] font-bold text-white">
              ?
            </span>
            <span className="flex-1 bg-background px-3 py-2 text-center text-sm font-medium text-blue-500">
              Other {title}
            </span>
          </button>
        )}

        <button className="rounded-md bg-slate-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-500">
          More Choices...
        </button>
      </div>
    </div>
  );
}
