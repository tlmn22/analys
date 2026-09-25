"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EDITABLE_EVENTS,
  TYPE_OPTIONS_BY_EVENT,
  FREE_TEXT_TYPE_EVENTS,
} from "@/lib/tag-events";
import type { TaggedEvent, TeamInfo } from "./types";
import { supportsDecisionQuality, type DecisionQuality } from "@/lib/decision-quality";
import { DecisionQualityPicker } from "./decision-quality-picker";

function currentTypeValue(e: TaggedEvent): string {
  switch (e.eventType) {
    case "boxout":
      return e.boxoutType ?? "";
    case "turnover":
      return e.turnoverType ?? "";
    case "off_foul":
    case "def_foul":
      return e.foulType ?? "";
    case "screen_set":
      return e.screenSetType ?? "";
    case "screen_rcvd":
      return e.screenRcvdType ?? "";
    case "hustle_play":
      return e.hustlePlayType ?? "";
    case "set_offense":
      return e.setOffenseName ?? "";
    case "blob":
      return e.blobPlayName ?? "";
    case "slob":
      return e.slobPlayName ?? "";
    case "man_to_man":
      return e.manToManType ?? "";
    case "zone":
      return e.zoneType ?? "";
    case "press":
      return e.pressType ?? "";
    case "off_action":
      return e.offActionType ?? "";
    case "def_coverage":
      return e.defCoverageType ?? "";
    case "def_offball":
      return e.defOffballType ?? "";
    case "physical_contact":
      return e.physicalContactType ?? "";
    case "other_assist":
      return e.assistType ?? "";
    default:
      return "";
  }
}

export interface UpdateEventFields {
  decisionQuality?: DecisionQuality;
  eventType: string;
  label: string;
  teamId: string | null;
  playerId: string | null;
  points: number | null;
  videoTime: number;
  clockTime: number;
  keyEvent: boolean;
  typeValue: string | null;
}

export function EditEventModal({
  event,
  teams,
  teamIdByPlayerId,
  getCurrentVideoTime,
  getCurrentClockTime,
  onUpdate,
  onDelete,
  onCancel,
  errorText,
  onRetry,
  blocked = false,
  decisionEnabled = false,
}: {
  event: TaggedEvent;
  teams: TeamInfo[];
  teamIdByPlayerId: Map<string, string>;
  getCurrentVideoTime: () => number;
  getCurrentClockTime: () => number;
  onUpdate: (fields: UpdateEventFields) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
  errorText?: string;
  onRetry?: () => void;
  blocked?: boolean;
  decisionEnabled?: boolean;
}) {
  const [eventType, setEventType] = useState(event.eventType);
  const [playerId, setPlayerId] = useState(event.playerId ?? "");
  const [teamId, setTeamId] = useState(event.teamId ?? teams[0]?.id ?? "");
  const [typeValue, setTypeValue] = useState(currentTypeValue(event));
  const [keyEvent, setKeyEvent] = useState(event.keyEvent);
  const [videoTime, setVideoTime] = useState(event.videoTime);
  const [clockTime, setClockTime] = useState(event.clockTime);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality>(event.decisionQuality ?? null);

  const eventDef = EDITABLE_EVENTS.find((e) => e.type === eventType);
  const isEditableType = !!eventDef;
  const typeOptions = TYPE_OPTIONS_BY_EVENT[eventType];
  const isFreeText = FREE_TEXT_TYPE_EVENTS.has(eventType);
  const needsPlayer = eventDef?.needsPlayer ?? true;

  function handleEventTypeChange(next: string) {
    setEventType(next);
    setTypeValue("");
    if (!supportsDecisionQuality(next)) setDecisionQuality(null);
  }

  async function handleUpdate() {
    if (blocked) return;
    setSaving(true);
    try {
      const resolvedTeamId = needsPlayer ? (playerId ? (teamIdByPlayerId.get(playerId) ?? null) : null) : teamId;
      await onUpdate({
        eventType,
        label: eventDef?.label ?? eventType,
        teamId: resolvedTeamId,
        playerId: needsPlayer ? playerId || null : null,
        points: eventDef?.points ?? null,
        videoTime,
        clockTime,
        keyEvent,
        typeValue: typeValue || null,
        decisionQuality: decisionEnabled ? decisionQuality : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (blocked) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg bg-background p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {errorText && <div role="alert" className="mb-3 text-sm text-red-400">{errorText}<Button size="sm" onClick={onRetry}>Дахин оролдох</Button></div>}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">
            Edit Event: {event.label} @ {event.clockTime.toFixed(1)}
          </span>
          <button onClick={onCancel} className="text-red-500 hover:text-red-400">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 text-sm">
          {supportsDecisionQuality(eventType) && <DecisionQualityPicker value={decisionQuality} onChange={setDecisionQuality} disabled={!decisionEnabled || blocked || saving} />}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Event:</label>
            <select
              value={eventType}
              onChange={(e) => handleEventTypeChange(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            >
              {!isEditableType && <option value={eventType}>{event.label} (not editable)</option>}
              {EDITABLE_EVENTS.map((ev) => (
                <option key={ev.type} value={ev.type}>
                  {ev.label}
                </option>
              ))}
            </select>
          </div>

          {needsPlayer ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Player:</label>
              <select
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                <option value="">—</option>
                {teams.map((t) => (
                  <optgroup key={t.id} label={t.name}>
                    {t.roster.map((p) => (
                      <option key={p.playerId} value={p.playerId}>
                        #{p.number} {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Team:</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1.5"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(typeOptions || isFreeText) && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Type:</label>
              {isFreeText ? (
                <Input value={typeValue} onChange={(e) => setTypeValue(e.target.value)} placeholder="Play name..." />
              ) : (
                <select
                  value={typeValue}
                  onChange={(e) => setTypeValue(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1.5"
                >
                  <option value="">—</option>
                  {typeOptions!.map((t) => (
                    <option key={t.label} value={t.label}>
                      {t.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={keyEvent} onChange={(e) => setKeyEvent(e.target.checked)} />
            Key Event
            <span className="text-xs text-muted-foreground">— тоглолтын эргэлтийн цэг</span>
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              Clock Time (game clock, seconds — the analyst-tracked clock, not the broadcast&apos;s own):
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                value={clockTime}
                onChange={(e) => setClockTime(Number(e.target.value))}
                className="w-28"
              />
              <Button variant="outline" size="sm" onClick={() => setClockTime((v) => Math.max(0, v - 1))}>
                -1s
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClockTime((v) => v + 1)}>
                +1s
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClockTime(getCurrentClockTime())}>
                Use current
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Video Time:</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                value={videoTime}
                onChange={(e) => setVideoTime(Number(e.target.value))}
                className="w-28"
              />
              <Button variant="outline" size="sm" onClick={() => setVideoTime((v) => Math.max(0, v - 1))}>
                -1s
              </Button>
              <Button variant="outline" size="sm" onClick={() => setVideoTime((v) => v + 1)}>
                +1s
              </Button>
              <Button variant="outline" size="sm" onClick={() => setVideoTime(getCurrentVideoTime())}>
                Use current
              </Button>
            </div>
          </div>

          <Button onClick={handleUpdate} disabled={saving} className="bg-green-600 text-white hover:bg-green-500">
            ✓ Update Event
          </Button>

          <div className="mt-1 border-t border-border pt-3">
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Устгах уу?</span>
                <Button variant="destructive" size="sm" disabled={saving} onClick={handleDelete}>
                  Тийм, устгах
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
                  Цуцлах
                </Button>
              </div>
            ) : (
              <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
                🗑 Delete Event
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
