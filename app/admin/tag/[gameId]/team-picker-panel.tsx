"use client";

import { Button } from "@/components/ui/button";
import type { TeamInfo } from "./types";

export function TeamPickerPanel({
  title,
  teams,
  onCancel,
  onDone,
}: {
  title: string;
  teams: TeamInfo[];
  onCancel: () => void;
  onDone: (teamId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={onCancel}>
        ← Cancel
      </Button>
      <div className="text-sm font-semibold">{title}</div>
      <div className="flex flex-col gap-1.5">
        {teams.map((t) => (
          <Button key={t.id} variant="outline" onClick={() => onDone(t.id)}>
            {t.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
