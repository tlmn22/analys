"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { playerLabel, type RosterPlayer, type TeamInfo } from "./types";

type Lineup = Record<string, (RosterPlayer | null)[]>;

type Stage =
  | { kind: "main" }
  | { kind: "pickFive"; teamId: string }
  | { kind: "slot"; teamId: string; slot: number };

export function SubstitutionPanel({
  teams,
  lineup,
  onCancel,
  onBulkSet,
  onSlotSet,
}: {
  teams: TeamInfo[];
  lineup: Lineup;
  onCancel: () => void;
  onBulkSet: (teamId: string, players: RosterPlayer[]) => Promise<void>;
  onSlotSet: (teamId: string, slot: number, player: RosterPlayer) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "main" });

  if (stage.kind === "pickFive") {
    const team = teams.find((t) => t.id === stage.teamId);
    if (!team) return null;
    return (
      <PickFiveView
        team={team}
        onCancel={() => setStage({ kind: "main" })}
        onDone={async (players) => {
          // Wait for all 5 lineup_set commits to land before letting the
          // user move on — otherwise a fast next action (e.g. Start Action)
          // can race ahead and read a since-changed game clock, corrupting
          // the tail commits' timestamps.
          await onBulkSet(team.id, players);
          setStage({ kind: "main" });
        }}
      />
    );
  }

  if (stage.kind === "slot") {
    const team = teams.find((t) => t.id === stage.teamId);
    if (!team) return null;
    const onCourtIds = new Set(
      (lineup[team.id] ?? []).filter(Boolean).map((p) => (p as RosterPlayer).playerId)
    );
    const bench = team.roster.filter((p) => !onCourtIds.has(p.playerId));
    return (
      <SlotPickerView
        bench={bench}
        onCancel={() => setStage({ kind: "main" })}
        onDone={async (player) => {
          await onSlotSet(stage.teamId, stage.slot, player);
          setStage({ kind: "main" });
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={onCancel}>
        ← Close
      </Button>
      {teams.map((team) => (
        <div key={team.id} className="flex flex-col gap-1.5">
          <div className="font-semibold">{team.name}</div>
          <Button size="sm" onClick={() => setStage({ kind: "pickFive", teamId: team.id })}>
            Pick 5 Players
          </Button>
          {(lineup[team.id] ?? [null, null, null, null, null]).map((p, i) => (
            <Button
              key={i}
              variant="outline"
              className="justify-start"
              onClick={() => setStage({ kind: "slot", teamId: team.id, slot: i + 1 })}
            >
              {p ? playerLabel(p) : "?"}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}

function PickFiveView({
  team,
  onCancel,
  onDone,
}: {
  team: TeamInfo;
  onCancel: () => void;
  onDone: (players: RosterPlayer[]) => Promise<void>;
}) {
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function tap(p: RosterPlayer) {
    if (saving || pickedIds.includes(p.playerId)) return;
    const next = [...pickedIds, p.playerId];
    setPickedIds(next);
    if (next.length === 5) {
      setSaving(true);
      await onDone(next.map((id) => team.roster.find((r) => r.playerId === id) as RosterPlayer));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={onCancel} disabled={saving}>
        ← Back
      </Button>
      <div className="text-sm font-semibold">Pick 5 Players — {team.name}</div>
      <p className="text-xs text-muted-foreground">
        {saving ? "Saving..." : `Tap 5 players (${pickedIds.length} / 5 selected)`}
      </p>
      <div className="flex flex-col gap-1.5">
        {team.roster.map((p) => {
          const picked = pickedIds.includes(p.playerId);
          return (
            <Button
              key={p.playerId}
              variant="outline"
              disabled={picked || saving}
              className={picked ? "justify-start bg-emerald-600 text-white opacity-100" : "justify-start"}
              onClick={() => tap(p)}
            >
              {playerLabel(p)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function SlotPickerView({
  bench,
  onCancel,
  onDone,
}: {
  bench: RosterPlayer[];
  onCancel: () => void;
  onDone: (player: RosterPlayer) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function pick(p: RosterPlayer) {
    if (saving) return;
    setSaving(true);
    await onDone(p);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-border p-3">
      <Button variant="outline" onClick={onCancel} disabled={saving}>
        ← Back
      </Button>
      <div className="text-sm font-semibold">{saving ? "Saving..." : "Select player"}</div>
      {bench.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bench players available.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {bench.map((p) => (
            <Button key={p.playerId} variant="outline" className="justify-start" disabled={saving} onClick={() => pick(p)}>
              {playerLabel(p)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
