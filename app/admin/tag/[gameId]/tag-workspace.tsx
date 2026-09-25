"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUTO_FLIP_TYPES, OTHER_MORE, EDITABLE_EVENTS, type EventDef } from "@/lib/tag-events";
import { addPlayName, tagEvent, restoreLineup, undoTagEvents, updateEvent, deleteEvent } from "./actions";
import { ActionPanel } from "./action-panel";
import { EditEventModal, type UpdateEventFields } from "./edit-event-modal";
import { EventsPanel } from "./events-panel";
import { MoreEventsPanel } from "./more-events-panel";
import { PlayerPickerPanel } from "./player-picker-panel";
import { PlayNamePanel } from "./play-name-panel";
import { ShotDetailPanel } from "./shot-detail-panel";
import { SubstitutionPanel } from "./substitution-panel";
import { TeamPickerPanel } from "./team-picker-panel";
import { TypeDetailPanel } from "./type-detail-panel";
import { playerLabel, type RosterPlayer, type ShotDetails, type TaggedEvent, type TeamInfo } from "./types";
import { VideoPanel, type VideoPanelHandle } from "./video-panel";
import { eventDetailCleanup } from "./event-detail-cleanup";
import { normalizeDecisionQuality, supportsDecisionQuality, type DecisionQuality } from "@/lib/decision-quality";
import { DecisionQualityPicker } from "./decision-quality-picker";

type Lineup = Record<string, (RosterPlayer | null)[]>;
const emptyShot = (): ShotDetails => ({ andOne: false, badMiss: false, contestedClose: false, lateClock: false, lightlyContested: false, uncontested: false, wideOpen: false, shotQuality: null, shotType: "", shotX: null, shotY: null });
type Capture = { clockTime: number; videoTime: number; playing: boolean };
type UndoEntry = { ids: string[]; lineup: Lineup; period: number; off: string; def: string; live: boolean; capture: Capture; lineupTeam?: string; followUp: "rebound" | "ft" | null };

export function TagWorkspace({
  gameId,
  videoUrl,
  homeTeam,
  visitorTeam,
  initialLineup,
  initialEvents,
  initialPlayNames,
  initialPeriod,
  initialClockTime,
  initialVideoTime,
  initialOffTeamId,
  initialDefTeamId,
  decisionEnabled = false,
}: {
  gameId: string;
  videoUrl: string;
  homeTeam: TeamInfo;
  visitorTeam: TeamInfo;
  initialLineup: Lineup;
  initialEvents: TaggedEvent[];
  initialPlayNames: Record<string, string[]>;
  initialPeriod: number;
  initialClockTime: number;
  initialVideoTime: number;
  initialOffTeamId: string;
  initialDefTeamId: string;
  decisionEnabled?: boolean;
}) {
  const teams = useMemo(() => [homeTeam, visitorTeam], [homeTeam, visitorTeam]);
  const rosterByPlayerId = useMemo(() => {
    const map = new Map<string, RosterPlayer>();
    for (const t of teams) for (const p of t.roster) map.set(p.playerId, p);
    return map;
  }, [teams]);
  const teamIdByPlayerId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) for (const p of t.roster) map.set(p.playerId, t.id);
    return map;
  }, [teams]);

  const videoRef = useRef<VideoPanelHandle>(null);

  const [period, setPeriod] = useState(initialPeriod);
  const [live, setLive] = useState(false);
  const [offTeamId, setOffTeamId] = useState(initialOffTeamId);
  const [defTeamId, setDefTeamId] = useState(initialDefTeamId);
  const [lineup, setLineup] = useState<Lineup>(initialLineup);
  const [events, setEvents] = useState<TaggedEvent[]>(initialEvents);
  const scores = useMemo(() => {
    const s: Record<string, number> = { [homeTeam.id]: 0, [visitorTeam.id]: 0 };
    for (const e of events) {
      if (e.points && e.teamId) s[e.teamId] = (s[e.teamId] ?? 0) + e.points;
    }
    return s;
  }, [events, homeTeam.id, visitorTeam.id]);

  const [pickerState, setPickerState] = useState<{ event: EventDef } | null>(null);
  const [shotModalState, setShotModalState] = useState<{ event: EventDef; teamId: string } | null>(
    null
  );
  const [typeModalState, setTypeModalState] = useState<{ event: EventDef } | null>(null);
  const [teamPickerState, setTeamPickerState] = useState<{ event: EventDef } | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [moreOtherOpen, setMoreOtherOpen] = useState(false);
  const [playNameModalState, setPlayNameModalState] = useState<{ event: EventDef } | null>(null);
  const [editingEvent, setEditingEvent] = useState<TaggedEvent | null>(null);
  const [playNames, setPlayNames] = useState<Record<string, string[]>>(initialPlayNames);
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [benchSlot, setBenchSlot] = useState<{ teamId: string; slot: number } | null>(null);
  const [subMode, setSubMode] = useState(false);
  const [status, setStatus] = useState("Бэлэн");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const [followUp, setFollowUp] = useState<"rebound" | "ft" | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [decisionQuality, setDecisionQuality] = useState<DecisionQuality>(null);
  const activePlayerEvent = shotModalState?.event ?? typeModalState?.event ?? pickerState?.event;
  const captureRef = useRef<Capture | null>(null);
  const busyRef = useRef(false);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const operationRef = useRef<UndoEntry | null>(null);
  const eventIndexRef = useRef(0);
  const blocked = saving || failed;
  useEffect(() => {
    if (!blocked) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [blocked]);

  function capture() {
    if (!captureRef.current) {
      if (!videoRef.current?.isReady()) { setStatus("Видео бэлэн болохыг хүлээнэ үү."); return false; }
      captureRef.current = { ...videoRef.current.getSnapshot(), playing: videoRef.current.isPlaying() };
      setCapturing(true);
      videoRef.current.pause();
    }
    return true;
  }
  function closePanels() {
    setPickerState(null); setShotModalState(null); setTypeModalState(null); setTeamPickerState(null);
    setPlayNameModalState(null); setSubOpen(false); setBenchSlot(null);
  }
  function finishCapture() {
    const captured = captureRef.current;
    captureRef.current = null;
    setCapturing(false);
    closePanels();
    setDecisionQuality(null);
    if (captured?.playing) videoRef.current?.play();
  }
  function cancelCapture() { if (!busyRef.current && !retryRef.current) finishCapture(); }

  async function runOperation(work: () => Promise<void>, record = true, lineupTeam?: string) {
    if (busyRef.current || retryRef.current) return;
    if (!capture()) return;
    const entry: UndoEntry = { ids: [], lineup, period, off: offTeamId, def: defTeamId, live, capture: { ...captureRef.current! }, lineupTeam, followUp };
    const attempt = async () => {
      if (busyRef.current) return;
      busyRef.current = true; setSaving(true); setFailed(false); setStatus("Хадгалж байна…");
      operationRef.current = entry; eventIndexRef.current = 0;
      try {
        await work();
        if (record && entry.ids.length) setHistory(prev => [...prev, entry]);
        retryRef.current = null; setStatus("Хадгаллаа"); finishCapture();
      } catch (error) {
        retryRef.current = attempt; setFailed(true);
        setStatus(`Хадгалсангүй: ${error instanceof Error ? error.message : String(error)}`);
      } finally { busyRef.current = false; operationRef.current = null; setSaving(false); }
    };
    await attempt();
  }

  async function undoLast() {
    const entry = history.at(-1);
    if (!entry) return;
    await runOperation(async () => {
      if (entry.lineupTeam) {
        const res = await restoreLineup(gameId, entry.lineupTeam, (entry.lineup[entry.lineupTeam] ?? [null, null, null, null, null]).map(p => p?.playerId ?? null));
        if (res.error) throw new Error(res.error);
      }
      const res = await undoTagEvents(gameId, entry.ids);
      if (res.error) throw new Error(res.error);
      setEvents(prev => prev.filter(e => !entry.ids.includes(e.id)));
      setLineup(entry.lineup); setPeriod(entry.period); setOffTeamId(entry.off); setDefTeamId(entry.def); setLive(entry.live);
      setFollowUp(entry.followUp); setHistory(prev => prev.slice(0, -1));
      videoRef.current?.seekTo(entry.capture.videoTime); videoRef.current?.setClock(entry.capture.clockTime);
      captureRef.current = { ...entry.capture, playing: false };
    }, false);
  }

  const team = (id: string) => teams.find((t) => t.id === id)!;

  // Tagging is limited to the current on-court players; empty slots are visible above.
  function rosterForPicking(teamId: string): RosterPlayer[] {
    const onCourt = (lineup[teamId] ?? []).filter((p): p is RosterPlayer => p !== null);
    return onCourt;
  }

  // Most events belong to whichever side is currently on offense/defense.
  // A few (Loose Ball Foul, Hustle Play, ...) can happen to anyone on the
  // floor, so they show all 10 on-court players and the team is resolved
  // from whoever actually gets picked instead of being fixed up front.
  function rosterForEvent(eventDef: EventDef): RosterPlayer[] {
    if (eventDef.bothTeams) {
      return [...rosterForPicking(homeTeam.id), ...rosterForPicking(visitorTeam.id)];
    }
    return rosterForPicking(eventDef.side === "def" ? defTeamId : offTeamId);
  }

  function teamIdForEvent(eventDef: EventDef, player: RosterPlayer | null): string | null {
    if (eventDef.bothTeams) {
      return player ? (teamIdByPlayerId.get(player.playerId) ?? null) : null;
    }
    return eventDef.side ? (eventDef.side === "def" ? defTeamId : offTeamId) : null;
  }

  // For the physical-contact second-player stage: the other team's
  // on-court 5, given whichever player was picked first.
  function opponentRoster(p: RosterPlayer): RosterPlayer[] {
    const pTeam = teamIdByPlayerId.get(p.playerId);
    const oppTeam = pTeam === homeTeam.id ? visitorTeam.id : homeTeam.id;
    return rosterForPicking(oppTeam);
  }

  function swapOffDef() {
    // Only 2 teams exist, so swapping either badge always means "the other
    // team is now offense/defense" — same behavior as the Python app's
    // _toggle_off_team / _toggle_def_team, which did the identical swap.
    setOffTeamId((cur) => {
      const next = cur === homeTeam.id ? visitorTeam.id : homeTeam.id;
      setDefTeamId(cur);
      return next;
    });
  }

  async function commit(
    eventDef: EventDef,
    teamId: string | null,
    player: RosterPlayer | null,
    assistPlayer: RosterPlayer | null,
    shotDetails?: ShotDetails,
    defender?: RosterPlayer | null,
    typeDetailResult?: {
      type: string;
      modifiers: Record<string, boolean>;
      secondPlayer?: RosterPlayer | null;
      outcome?: string | null;
      winner?: RosterPlayer | null;
    }
  ) {
    if (player && !["sub_in", "sub_out", "lineup_set"].includes(eventDef.type) && !rosterForPicking(teamId!).some(p => p.playerId === player.playerId)) {
      throw new Error("Энэ тоглогч талбайн бүрэлдэхүүнд байхгүй байна.");
    }
      // The type-detail panel is shared across events (turnover, off_foul,
      // screen_set, screen_rcvd, ...) but each stores its picked type in its
      // own column — map here, in the one place that knows both the event
      // and the DB shape.
      let assistType: string | null = null;
      let turnoverType: string | null = null;
      let screenSetType: string | null = null;
      let screenRcvdType: string | null = null;
      let screenerPlayerId: string | null = null;
      let screenTargetPlayerId: string | null = null;
      let hustlePlayType: string | null = null;
      let setOffenseName: string | null = null;
      let blobPlayName: string | null = null;
      let blobOutcome: string | null = null;
      let slobPlayName: string | null = null;
      let slobOutcome: string | null = null;
      let manToManType: string | null = null;
      let zoneType: string | null = null;
      let pressType: string | null = null;
      let offActionType: string | null = null;
      let defCoverageType: string | null = null;
      let defOffballType: string | null = null;
      let physicalContactType: string | null = null;
      let physicalContactSecondPlayerId: string | null = null;
      let physicalContactWinnerPlayerId: string | null = null;
      let boxoutType: string | null = null;
      let foulDetails:
        | { type: string; fiftyFifty: boolean; badCall: boolean; correctCall: boolean }
        | undefined;
      if (typeDetailResult) {
        if (eventDef.type === "other_assist") {
          assistType = typeDetailResult.type;
        } else if (eventDef.type === "turnover") {
          turnoverType = typeDetailResult.type;
        } else if (eventDef.type === "off_foul" || eventDef.type === "def_foul") {
          foulDetails = {
            type: typeDetailResult.type,
            fiftyFifty: !!typeDetailResult.modifiers.fiftyFifty,
            badCall: !!typeDetailResult.modifiers.badCall,
            correctCall: !!typeDetailResult.modifiers.correctCall,
          };
        } else if (eventDef.type === "screen_set") {
          screenSetType = typeDetailResult.type;
          screenTargetPlayerId = typeDetailResult.secondPlayer?.playerId ?? null;
        } else if (eventDef.type === "screen_rcvd") {
          screenRcvdType = typeDetailResult.type;
          screenerPlayerId = typeDetailResult.secondPlayer?.playerId ?? null;
        } else if (eventDef.type === "hustle_play") {
          hustlePlayType = typeDetailResult.type;
        } else if (eventDef.type === "set_offense") {
          setOffenseName = typeDetailResult.type;
        } else if (eventDef.type === "blob") {
          blobPlayName = typeDetailResult.type;
          blobOutcome = typeDetailResult.outcome ?? null;
        } else if (eventDef.type === "slob") {
          slobPlayName = typeDetailResult.type;
          slobOutcome = typeDetailResult.outcome ?? null;
        } else if (eventDef.type === "man_to_man") {
          manToManType = typeDetailResult.type;
        } else if (eventDef.type === "zone") {
          zoneType = typeDetailResult.type;
        } else if (eventDef.type === "press") {
          pressType = typeDetailResult.type;
        } else if (eventDef.type === "off_action") {
          offActionType = typeDetailResult.type;
        } else if (eventDef.type === "def_coverage") {
          defCoverageType = typeDetailResult.type;
        } else if (eventDef.type === "def_offball") {
          defOffballType = typeDetailResult.type;
        } else if (eventDef.type === "physical_contact") {
          physicalContactType = typeDetailResult.type;
          physicalContactSecondPlayerId = typeDetailResult.secondPlayer?.playerId ?? null;
          physicalContactWinnerPlayerId = typeDetailResult.winner?.playerId ?? null;
        } else if (eventDef.type === "boxout") {
          boxoutType = typeDetailResult.type;
        }
      }

      const snapshot = captureRef.current ?? videoRef.current!.getSnapshot();
      const operation = operationRef.current;
      const index = eventIndexRef.current++;
      const id = operation ? (operation.ids[index] ??= crypto.randomUUID()) : crypto.randomUUID();
      const result = await tagEvent({
        id,
        gameId,
        period,
        clockTime: snapshot.clockTime,
        videoTime: snapshot.videoTime,
        eventType: eventDef.type,
        decisionQuality: decisionEnabled ? normalizeDecisionQuality(eventDef.type, player?.playerId ?? null, decisionQuality) : undefined,
        label: eventDef.label,
        teamId,
        playerId: player?.playerId ?? null,
        assistPlayerId: assistPlayer?.playerId ?? null,
        defenderPlayerId: defender?.playerId ?? null,
        screenerPlayerId,
        screenTargetPlayerId,
        points: eventDef.points ?? null,
        shotDetails,
        assistType,
        turnoverType,
        foulDetails,
        screenSetType,
        screenRcvdType,
        hustlePlayType,
        setOffenseName,
        blobPlayName,
        blobOutcome,
        slobPlayName,
        slobOutcome,
        manToManType,
        zoneType,
        pressType,
        offActionType,
        defCoverageType,
        defOffballType,
        physicalContactType,
        physicalContactSecondPlayerId,
        physicalContactWinnerPlayerId,
        boxoutType,
      });
      if ("error" in result) {
        throw new Error(result.error);
      }

      const newEvent: TaggedEvent = {
        id: result.id,
        period,
        clockTime: snapshot.clockTime,
        videoTime: snapshot.videoTime,
        eventType: eventDef.type,
        decisionQuality: normalizeDecisionQuality(eventDef.type, player?.playerId ?? null, decisionQuality),
        label: eventDef.label,
        color: eventDef.color,
        teamId,
        playerId: player?.playerId ?? null,
        playerLabel: player ? playerLabel(player) : null,
        assistPlayerLabel: assistPlayer ? playerLabel(assistPlayer) : null,
        points: eventDef.points ?? null,
        keyEvent: false,
        shotType: shotDetails?.shotType || null,
        shotDetails,
        assistPlayerId: assistPlayer?.playerId ?? null,
        defenderLabel: defender ? playerLabel(defender) : null,
        assistType,
        turnoverType,
        foulType: foulDetails?.type || null,
        screenSetType,
        screenRcvdType,
        hustlePlayType,
        setOffenseName,
        blobPlayName,
        blobOutcome,
        slobPlayName,
        slobOutcome,
        manToManType,
        zoneType,
        pressType,
        offActionType,
        defCoverageType,
        defOffballType,
        screenerLabel:
          eventDef.type === "screen_rcvd" && typeDetailResult?.secondPlayer
            ? playerLabel(typeDetailResult.secondPlayer)
            : null,
        screenTargetLabel:
          eventDef.type === "screen_set" && typeDetailResult?.secondPlayer
            ? playerLabel(typeDetailResult.secondPlayer)
            : null,
        physicalContactType,
        physicalContactSecondLabel:
          eventDef.type === "physical_contact" && typeDetailResult?.secondPlayer
            ? playerLabel(typeDetailResult.secondPlayer)
            : null,
        physicalContactWinnerLabel: typeDetailResult?.winner ? playerLabel(typeDetailResult.winner) : null,
        boxoutType,
      };
      setEvents((prev) => [newEvent, ...prev.filter(e => e.id !== newEvent.id)]);

      if (eventDef.type === "end_quarter") {
        setPeriod(period + 1);
        videoRef.current?.resetClock();
      }

      // Auto-flip who's on offense whenever the current possession
      // unambiguously ends — matches the same event set used to
      // reconstruct possessions in the reports (see pace-stats.ts), minus
      // free throws (a single FT doesn't reliably mean the trip is over).
      // Off Reb is deliberately excluded: it continues the same team's
      // possession rather than ending it. Jump-ball/held-ball situations
      // still need the manual Off/Def swap buttons — this only covers the
      // common case.
      if (AUTO_FLIP_TYPES.has(eventDef.type) && !shotDetails?.andOne) {
        setOffTeamId(defTeamId); setDefTeamId(offTeamId);
      }
      if (shotDetails?.andOne) { setFollowUp("ft"); setLive(false); }
      else if (/^(2pt|3pt)_miss$/.test(eventDef.type)) setFollowUp("rebound");
      else if (["off_reb", "def_reb"].includes(eventDef.type)) setFollowUp(null);
  }

  function handleEventTriggered(eventDef: EventDef) {
    if (busyRef.current || retryRef.current || editingEvent || !capture()) return;
    setMoreOtherOpen(false);
    setDecisionQuality(null);
    if (eventDef.type === "sub") {
      setSubOpen(true);
      return;
    }
    if (eventDef.playNameDetail) {
      setPlayNameModalState({ event: eventDef });
      return;
    }
    if (eventDef.detailedShot) {
      setShotModalState({ event: eventDef, teamId: teamIdForEvent(eventDef, null) as string });
      return;
    }
    if (eventDef.typeDetail) {
      setTypeModalState({ event: eventDef });
      return;
    }
    if (eventDef.needsTeam) {
      setTeamPickerState({ event: eventDef });
      return;
    }
    if (!eventDef.needsPlayer) {
      void runOperation(() => commit(eventDef, teamIdForEvent(eventDef, null), null, null));
      return;
    }
    setPickerState({ event: eventDef });
  }

  async function handlePickPlayName(eventDef: EventDef, name: string, outcome: string | null) {
    await runOperation(async () => {
    const category = eventDef.playNameDetail!.category;
    const existing = playNames[category] ?? [];
    if (!existing.includes(name)) {
      const res = await addPlayName(gameId, category, name);
      if (res.error) {
        alert(`Алдаа: ${res.error}`);
        return;
      }
      setPlayNames((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), name] }));
    }
    await commit(eventDef, teamIdForEvent(eventDef, null), null, null, undefined, null, {
      type: name,
      modifiers: {},
      outcome,
    });
    });
  }

  async function changeLineup(teamId: string, players: (RosterPlayer | null)[]) {
    await runOperation(async () => {
      const before = lineup[teamId] ?? [null, null, null, null, null];
      const incoming = players.filter((p): p is RosterPlayer => !!p);
      if (new Set(incoming.map(p => p.playerId)).size !== incoming.length) throw new Error("Давхардсан тоглогч байна.");
      for (const player of before) {
        if (player && !incoming.some(p => p.playerId === player.playerId))
          await commit({ key: "", label: "Sub out", type: "sub_out", needsPlayer: false, color: "gray" }, teamId, player, null);
      }
      for (const player of incoming) {
        if (!before.some(p => p?.playerId === player.playerId))
          await commit({ key: "", label: "Sub in", type: "sub_in", needsPlayer: false, color: "gray" }, teamId, player, null);
      }
      const res = await restoreLineup(gameId, teamId, players.map(p => p?.playerId ?? null));
      if (res.error) throw new Error(res.error);
      setLineup(prev => ({ ...prev, [teamId]: players })); setSelectedPlayer(null); setSubMode(false);
    }, true, teamId);
  }
  async function handleBulkSet(teamId: string, players: RosterPlayer[]) { await changeLineup(teamId, players); }
  async function handleSlotSet(teamId: string, slot: number, player: RosterPlayer) {
    const next = [...(lineup[teamId] ?? [null, null, null, null, null])];
    next[slot - 1] = player;
    await changeLineup(teamId, next);
  }

  async function handleUpdateEvent(fields: UpdateEventFields) {
    if (!editingEvent) return;
    await runOperation(async () => {
    const res = await updateEvent({ id: editingEvent.id, ...fields });
    if (res.error) {
      throw new Error(res.error);
    }
    const player = fields.playerId ? rosterByPlayerId.get(fields.playerId) : null;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === editingEvent.id
          ? {
              ...e,
              ...eventDetailCleanup(fields.eventType).display,
              shotDetails: /^(2pt|3pt)_(made|miss)$/.test(fields.eventType) && e.shotDetails ? {
                ...e.shotDetails,
                andOne: fields.eventType.endsWith("_made") && e.shotDetails.andOne,
                badMiss: fields.eventType.endsWith("_miss") && e.shotDetails.badMiss,
              } : undefined,
              eventType: fields.eventType,
              decisionQuality: normalizeDecisionQuality(fields.eventType, fields.playerId, fields.decisionQuality),
              label: fields.label,
              teamId: fields.teamId,
              playerId: fields.playerId,
              playerLabel: player ? playerLabel(player) : null,
              points: fields.points,
              videoTime: fields.videoTime,
              clockTime: fields.clockTime,
              keyEvent: fields.keyEvent,
              turnoverType: fields.eventType === "turnover" ? fields.typeValue : null,
              foulType: fields.eventType === "off_foul" || fields.eventType === "def_foul" ? fields.typeValue : null,
              screenSetType: fields.eventType === "screen_set" ? fields.typeValue : null,
              screenRcvdType: fields.eventType === "screen_rcvd" ? fields.typeValue : null,
              hustlePlayType: fields.eventType === "hustle_play" ? fields.typeValue : null,
              setOffenseName: fields.eventType === "set_offense" ? fields.typeValue : null,
              blobPlayName: fields.eventType === "blob" ? fields.typeValue : null,
              slobPlayName: fields.eventType === "slob" ? fields.typeValue : null,
              manToManType: fields.eventType === "man_to_man" ? fields.typeValue : null,
              zoneType: fields.eventType === "zone" ? fields.typeValue : null,
              pressType: fields.eventType === "press" ? fields.typeValue : null,
              offActionType: fields.eventType === "off_action" ? fields.typeValue : null,
              defCoverageType: fields.eventType === "def_coverage" ? fields.typeValue : null,
              defOffballType: fields.eventType === "def_offball" ? fields.typeValue : null,
              physicalContactType: fields.eventType === "physical_contact" ? fields.typeValue : null,
              assistType: fields.eventType === "other_assist" ? fields.typeValue : null,
              boxoutType: fields.eventType === "boxout" ? fields.typeValue : null,
            }
          : e
      )
    );
    setEditingEvent(null);
    setHistory([]);
    }, false);
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    await runOperation(async () => {
    const res = await deleteEvent(editingEvent.id);
    if (res.error) {
      throw new Error(res.error);
    }
    setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
    setEditingEvent(null);
    setHistory([]);
    }, false);
  }

  return (
    <div className="dark flex h-screen min-w-[1050px] flex-col bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-3">
        <span className="font-semibold">
          Q{period} — {homeTeam.name} vs {visitorTeam.name}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {homeTeam.name} {scores[homeTeam.id] ?? 0} — {visitorTeam.name}{" "}
          {scores[visitorTeam.id] ?? 0}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" title="Энэ удаа нээснээс хойших сүүлийн бүртгэлийг буцаах" disabled={blocked || capturing || !history.length} onClick={undoLast}>↶ Буцаах</Button>
          <Button variant="outline" size="sm" disabled={blocked || capturing} onClick={swapOffDef}>
            Off: {team(offTeamId).name}
          </Button>
          <Button variant="outline" size="sm" disabled={blocked || capturing} onClick={swapOffDef}>
            Def: {team(defTeamId).name}
          </Button>
          <Link href={`/admin/tag/${gameId}/boxscore`}>
            <Button variant="outline" size="sm">
              Boxscore
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b px-3 py-2 text-sm" role="status" aria-live="polite">
        <span className={failed ? "text-red-400" : "text-emerald-400"}>{status}</span>
        {failed && <Button size="sm" disabled={saving} onClick={() => void retryRef.current?.()}>Дахин оролдох</Button>}
        <span className="ml-auto text-xs text-muted-foreground">Event сонгоход видео түр зогсоно · хадгалаад үргэлжилнэ</span>
      </div>
      <fieldset disabled={blocked || capturing || !!editingEvent} className="grid grid-cols-2 gap-3 border-b p-2">
        {teams.map(t => <div key={t.id} className={`rounded border p-2 ${t.id === offTeamId ? "border-orange-500 bg-orange-500/10" : "border-border"}`}>
          <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>{t.name} · {t.id === offTeamId ? "Довтолгоо" : "Хамгаалалт"}</span>
            <button type="button" className="text-xs underline" onClick={() => setSubMode(v => !v)}>{subMode ? "Сэлгээ цуцлах" : "Сэлгээ"}</button></div>
          <div className="grid grid-cols-5 gap-1">{(lineup[t.id] ?? [null, null, null, null, null]).map((p, i) => <button type="button" key={i}
            className={`min-h-14 rounded border px-1 text-xs disabled:opacity-50 ${p && selectedPlayer?.playerId === p.playerId ? "border-blue-400 bg-blue-500/30" : "bg-background"}`}
            onClick={() => { if (subMode || !p) { if (capture()) setBenchSlot({ teamId: t.id, slot: i + 1 }); } else setSelectedPlayer(p); }}>
            {p ? <><strong className="block text-lg">#{p.number}</strong>{p.firstName}</> : "+ Тоглогч"}</button>)}</div>
          {(lineup[t.id] ?? []).filter(Boolean).length !== 5 && <p className="mt-1 text-xs text-amber-400">Талбайн бүрэлдэхүүн 5 хүрээгүй. Тоглогчдоо сонгоно уу.</p>}
          {subMode && <p className="mt-1 text-xs text-blue-400">Гарах тоглогч → орох тоглогч</p>}
        </div>)}
      </fieldset>
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px]">
        <fieldset disabled={blocked || capturing} className="min-h-0 min-w-0">
        <EventsPanel
          events={events}
          onSeek={(t) => videoRef.current?.seekTo(t)}
          onEdit={(e) => { if (capture()) setEditingEvent(e); }}
        />
        </fieldset>
        <div inert={capturing} className={capturing ? "pointer-events-none min-h-0" : "min-h-0"}>
        <VideoPanel
          ref={videoRef}
          videoUrl={videoUrl}
          live={live && !capturing}
          initialClockTime={initialClockTime}
          initialVideoTime={initialVideoTime}
        />
        </div>
        <fieldset disabled={blocked} className="min-h-0 min-w-0 overflow-auto">
        {activePlayerEvent && supportsDecisionQuality(activePlayerEvent.type) && <div className="px-3 pt-3"><DecisionQualityPicker value={decisionQuality} onChange={setDecisionQuality} disabled={!decisionEnabled} /></div>}
        {benchSlot ? <PlayerPickerPanel title="Орох тоглогч" roster={team(benchSlot.teamId).roster.filter(p => !(lineup[benchSlot.teamId] ?? []).some(on => on?.playerId === p.playerId))}
          onCancel={cancelCapture} onDone={p => void handleSlotSet(benchSlot.teamId, benchSlot.slot, p)} />
        : pickerState ? (
          <PlayerPickerPanel
            key={pickerState.event.type}
            freeThrow={pickerState.event.type.startsWith("ft_")}
            finalFreeThrow={followUp === "ft"}
            title={`${pickerState.event.label} — select player`}
            roster={rosterForEvent(pickerState.event)}
            onCancel={cancelCapture}
            onDone={(player, lastFreeThrow) => {
              void runOperation(async () => {
                await commit(pickerState.event, teamIdForEvent(pickerState.event, player), player, null);
                if (lastFreeThrow && pickerState.event.type.startsWith("ft_")) {
                  if (pickerState.event.type === "ft_made") { setOffTeamId(defTeamId); setDefTeamId(offTeamId); setFollowUp(null); }
                  else setFollowUp("rebound");
                }
              });
            }}
          />
        ) : shotModalState ? (
          <ShotDetailPanel
            initial={selectedPlayer && rosterForPicking(shotModalState.teamId).some(p => p.playerId === selectedPlayer.playerId) ? { player: selectedPlayer, details: emptyShot(), assistPlayer: null } : undefined}
            title={shotModalState.event.label}
            roster={rosterForPicking(shotModalState.teamId)}
            defenderRoster={rosterForPicking(defTeamId)}
            isThreePoint={shotModalState.event.type.startsWith("3pt")}
            isMade={shotModalState.event.type.endsWith("_made")}
            onCancel={cancelCapture}
            onDone={(player, details, defender, assistPlayer) => {
              void runOperation(() => commit(shotModalState.event, shotModalState.teamId, player, assistPlayer, details, defender));
            }}
          />
        ) : typeModalState ? (
          <TypeDetailPanel
            eventLabel={typeModalState.event.label}
            roster={rosterForEvent(typeModalState.event)}
            needsPlayer={typeModalState.event.needsPlayer}
            secondPlayerRoster={
              typeModalState.event.typeDetail?.secondPlayerOpponent ? opponentRoster : undefined
            }
            config={typeModalState.event.typeDetail!}
            onCancel={cancelCapture}
            onDone={(player, modifiers, type, secondPlayer, winner) => {
              void runOperation(() => commit(
                typeModalState.event,
                teamIdForEvent(typeModalState.event, player),
                player,
                null,
                undefined,
                null,
                { type, modifiers, secondPlayer, winner }
              ));
            }}
          />
        ) : teamPickerState ? (
          <TeamPickerPanel
            title={`${teamPickerState.event.label} — select team`}
            teams={teams}
            onCancel={cancelCapture}
            onDone={(teamId) => {
              void runOperation(() => commit(teamPickerState.event, teamId, null, null));
            }}
          />
        ) : subOpen ? (
          <SubstitutionPanel
            teams={teams}
            lineup={lineup}
            onCancel={cancelCapture}
            onBulkSet={handleBulkSet}
            onSlotSet={handleSlotSet}
          />
        ) : moreOtherOpen ? (
          <MoreEventsPanel
            title="More Other Player Events"
            events={OTHER_MORE}
            onCancel={() => setMoreOtherOpen(false)}
            onPick={handleEventTriggered}
          />
        ) : playNameModalState ? (
          <PlayNamePanel
            title={playNameModalState.event.label}
            names={playNames[playNameModalState.event.playNameDetail!.category] ?? []}
            outcomes={playNameModalState.event.playNameDetail!.outcomes}
            onCancel={cancelCapture}
            onDone={(name, outcome) => handlePickPlayName(playNameModalState.event, name, outcome)}
          />
        ) : editingEvent ? <p className="p-3 text-sm">Event засаж байна…</p> : (
          <>
          {followUp === "rebound" && <div className="border-b border-blue-500/30 bg-blue-500/10 p-3 text-sm">Самбарыг хэн авсан?
            <div className="mt-2 flex gap-2">{["off_reb", "def_reb"].map(type => <Button key={type} size="sm" onClick={() => { const def = EDITABLE_EVENTS.find(e => e.type === type); if (def) handleEventTriggered(def); }}>{type === "off_reb" ? "Довтолгооны" : "Хамгаалалтын"}</Button>)}<Button size="sm" variant="ghost" onClick={() => setFollowUp(null)}>Алгасах</Button></div>
          </div>}
          {followUp === "ft" && <div className="border-b bg-orange-500/10 p-3 text-sm">And-one · торгуулийн шидэлт
            <div className="mt-2 flex gap-2">{["ft_made", "ft_miss"].map(type => <Button key={type} size="sm" onClick={() => { const def = EDITABLE_EVENTS.find(e => e.type === type); if (def) handleEventTriggered(def); }}>{type === "ft_made" ? "Орсон" : "Алдсан"}</Button>)}
            </div>
          </div>}
          <ActionPanel
            live={live}
            onToggleLive={() => setLive((v) => !v)}
            onEventTriggered={handleEventTriggered}
            onShowMoreOther={() => setMoreOtherOpen(true)}
          />
          </>
        )}
        </fieldset>
      </div>

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          teams={teams}
          teamIdByPlayerId={teamIdByPlayerId}
          getCurrentVideoTime={() => videoRef.current?.getSnapshot().videoTime ?? editingEvent.videoTime}
          getCurrentClockTime={() => videoRef.current?.getSnapshot().clockTime ?? editingEvent.clockTime}
          onUpdate={handleUpdateEvent}
          onDelete={handleDeleteEvent}
          errorText={failed ? status : undefined}
          onRetry={() => void retryRef.current?.()}
          blocked={blocked}
          decisionEnabled={decisionEnabled}
          onCancel={() => { setEditingEvent(null); cancelCapture(); }}
        />
      )}
    </div>
  );
}
