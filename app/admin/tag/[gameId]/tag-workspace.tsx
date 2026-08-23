"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AUTO_FLIP_TYPES, OTHER_MORE, type EventDef } from "@/lib/tag-events";
import { addPlayName, tagEvent, setLineupBulk, setLineupSlot, updateEvent, deleteEvent } from "./actions";
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

type Lineup = Record<string, (RosterPlayer | null)[]>;

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
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = { [homeTeam.id]: 0, [visitorTeam.id]: 0 };
    for (const e of initialEvents) {
      if (e.points && e.teamId) s[e.teamId] = (s[e.teamId] ?? 0) + e.points;
    }
    return s;
  });

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

  const team = (id: string) => teams.find((t) => t.id === id)!;

  // Player pickers show only the 5 players currently on the floor for that
  // team; if the lineup hasn't been set yet (no Substitution done), fall
  // back to the full roster so tagging isn't blocked.
  function rosterForPicking(teamId: string): RosterPlayer[] {
    const onCourt = (lineup[teamId] ?? []).filter((p): p is RosterPlayer => p !== null);
    return onCourt.length > 0 ? onCourt : team(teamId).roster;
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
    // commit() is called fire-and-forget from onDone handlers (not
    // awaited), so any throw here would otherwise become a silent unhandled
    // rejection — the tag vanishes with no error shown. Catch everything
    // and alert, matching this project's zero-silent-failure requirement.
    try {
      // The type-detail panel is shared across events (turnover, off_foul,
      // screen_set, screen_rcvd, ...) but each stores its picked type in its
      // own column — map here, in the one place that knows both the event
      // and the DB shape.
      let assistType: string | null = null;
      let turnoverType: string | null = null;
      let screenSetType: string | null = null;
      let screenRcvdType: string | null = null;
      let screenerPlayerId: string | null = null;
      let hustlePlayType: string | null = null;
      let setOffenseName: string | null = null;
      let blobPlayName: string | null = null;
      let blobOutcome: string | null = null;
      let slobPlayName: string | null = null;
      let slobOutcome: string | null = null;
      let manToManType: string | null = null;
      let zoneType: string | null = null;
      let offActionType: string | null = null;
      let defCoverageType: string | null = null;
      let defOffballType: string | null = null;
      let physicalContactType: string | null = null;
      let physicalContactSecondPlayerId: string | null = null;
      let physicalContactWinnerPlayerId: string | null = null;
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
        }
      }

      const snapshot = videoRef.current?.getSnapshot() ?? { clockTime: 0, videoTime: 0 };
      const result = await tagEvent({
        gameId,
        period,
        clockTime: snapshot.clockTime,
        videoTime: snapshot.videoTime,
        eventType: eventDef.type,
        label: eventDef.label,
        teamId,
        playerId: player?.playerId ?? null,
        assistPlayerId: assistPlayer?.playerId ?? null,
        defenderPlayerId: defender?.playerId ?? null,
        screenerPlayerId,
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
        offActionType,
        defCoverageType,
        defOffballType,
        physicalContactType,
        physicalContactSecondPlayerId,
        physicalContactWinnerPlayerId,
      });
      if ("error" in result) {
        alert(`Алдаа: ${result.error}`);
        return;
      }

      const newEvent: TaggedEvent = {
        id: result.id,
        period,
        clockTime: snapshot.clockTime,
        videoTime: snapshot.videoTime,
        eventType: eventDef.type,
        label: eventDef.label,
        color: eventDef.color,
        teamId,
        playerId: player?.playerId ?? null,
        playerLabel: player ? playerLabel(player) : null,
        assistPlayerLabel: assistPlayer ? playerLabel(assistPlayer) : null,
        points: eventDef.points ?? null,
        keyEvent: false,
        shotType: shotDetails?.shotType || null,
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
        offActionType,
        defCoverageType,
        defOffballType,
        screenerLabel:
          eventDef.type === "screen_rcvd" && typeDetailResult?.secondPlayer
            ? playerLabel(typeDetailResult.secondPlayer)
            : null,
        physicalContactType,
        physicalContactSecondLabel:
          eventDef.type === "physical_contact" && typeDetailResult?.secondPlayer
            ? playerLabel(typeDetailResult.secondPlayer)
            : null,
        physicalContactWinnerLabel: typeDetailResult?.winner ? playerLabel(typeDetailResult.winner) : null,
      };
      setEvents((prev) => [newEvent, ...prev]);

      if (eventDef.points && teamId) {
        setScores((prev) => ({ ...prev, [teamId]: (prev[teamId] ?? 0) + eventDef.points! }));
      }
      if (eventDef.type === "end_quarter") {
        setPeriod((p) => p + 1);
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
      if (AUTO_FLIP_TYPES.has(eventDef.type)) {
        swapOffDef();
      }
    } catch (err) {
      alert(`Алдаа: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleEventTriggered(eventDef: EventDef) {
    setMoreOtherOpen(false);
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
      commit(eventDef, teamIdForEvent(eventDef, null), null, null);
      return;
    }
    setPickerState({ event: eventDef });
  }

  async function handlePickPlayName(eventDef: EventDef, name: string, outcome: string | null) {
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
    setPlayNameModalState(null);
  }

  async function handleBulkSet(teamId: string, players: RosterPlayer[]) {
    const res = await setLineupBulk(gameId, teamId, players.map((p) => p.playerId));
    if (res.error) {
      alert(`Алдаа: ${res.error}`);
      return;
    }
    setLineup((prev) => ({ ...prev, [teamId]: players }));

    // Log a timestamped "Starter" event per player so box-score MIN/+- can
    // reconstruct on-court intervals from the very start of the lineup,
    // not just from later substitutions.
    const starterEvent: EventDef = {
      key: "",
      label: "Starter",
      type: "lineup_set",
      needsPlayer: false,
      color: "gray",
    };
    for (const p of players) {
      await commit(starterEvent, teamId, p, null);
    }
  }

  async function handleSlotSet(teamId: string, slot: number, player: RosterPlayer) {
    const res = await setLineupSlot(gameId, teamId, slot, player.playerId);
    if (res.error) {
      alert(`Алдаа: ${res.error}`);
      return;
    }
    setLineup((prev) => {
      const arr = [...(prev[teamId] ?? [null, null, null, null, null])];
      arr[slot - 1] = player;
      return { ...prev, [teamId]: arr };
    });

    if (res.previousPlayerId) {
      const outgoing = rosterByPlayerId.get(res.previousPlayerId);
      // Direction-specific types (rather than one generic "sub") so the
      // box-score computation can reconstruct on-court intervals; both
      // still display as "Sub" in the event log.
      const subOutEvent: EventDef = {
        key: "",
        label: "Sub",
        type: "sub_out",
        needsPlayer: false,
        color: "gray",
      };
      const subInEvent: EventDef = {
        key: "",
        label: "Sub",
        type: "sub_in",
        needsPlayer: false,
        color: "gray",
      };
      if (outgoing) await commit(subOutEvent, teamId, outgoing, null);
      await commit(subInEvent, teamId, player, null);
    }
  }

  async function handleUpdateEvent(fields: UpdateEventFields) {
    if (!editingEvent) return;
    const res = await updateEvent({ id: editingEvent.id, ...fields });
    if (res.error) {
      alert(`Алдаа: ${res.error}`);
      return;
    }
    const player = fields.playerId ? rosterByPlayerId.get(fields.playerId) : null;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === editingEvent.id
          ? {
              ...e,
              eventType: fields.eventType,
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
              offActionType: fields.eventType === "off_action" ? fields.typeValue : null,
              defCoverageType: fields.eventType === "def_coverage" ? fields.typeValue : null,
              defOffballType: fields.eventType === "def_offball" ? fields.typeValue : null,
              physicalContactType: fields.eventType === "physical_contact" ? fields.typeValue : null,
              assistType: fields.eventType === "other_assist" ? fields.typeValue : null,
            }
          : e
      )
    );
    setEditingEvent(null);
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    const res = await deleteEvent(editingEvent.id);
    if (res.error) {
      alert(`Алдаа: ${res.error}`);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
    setEditingEvent(null);
  }

  return (
    <div className="dark grid h-screen grid-rows-[48px_1fr] bg-background text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-3">
        <span className="font-semibold">
          Q{period} — {homeTeam.name} vs {visitorTeam.name}
        </span>
        <span className="font-mono text-sm text-muted-foreground">
          {homeTeam.name} {scores[homeTeam.id] ?? 0} — {visitorTeam.name}{" "}
          {scores[visitorTeam.id] ?? 0}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={swapOffDef}>
            Off: {team(offTeamId).name}
          </Button>
          <Button variant="outline" size="sm" onClick={swapOffDef}>
            Def: {team(defTeamId).name}
          </Button>
          <Link href={`/admin/tag/${gameId}/boxscore`}>
            <Button variant="outline" size="sm">
              Boxscore
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[260px_1fr_320px]">
        <EventsPanel
          events={events}
          onSeek={(t) => videoRef.current?.seekTo(t)}
          onEdit={(e) => setEditingEvent(e)}
        />
        <VideoPanel
          ref={videoRef}
          videoUrl={videoUrl}
          live={live}
          initialClockTime={initialClockTime}
          initialVideoTime={initialVideoTime}
        />

        {pickerState ? (
          <PlayerPickerPanel
            title={`${pickerState.event.label} — select player`}
            roster={rosterForEvent(pickerState.event)}
            onCancel={() => setPickerState(null)}
            onDone={(player) => {
              commit(pickerState.event, teamIdForEvent(pickerState.event, player), player, null);
              setPickerState(null);
            }}
          />
        ) : shotModalState ? (
          <ShotDetailPanel
            title={shotModalState.event.label}
            roster={rosterForPicking(shotModalState.teamId)}
            defenderRoster={rosterForPicking(defTeamId)}
            isThreePoint={shotModalState.event.type.startsWith("3pt")}
            isMade={shotModalState.event.type.endsWith("_made")}
            onCancel={() => setShotModalState(null)}
            onDone={(player, details, defender, assistPlayer) => {
              commit(shotModalState.event, shotModalState.teamId, player, assistPlayer, details, defender);
              setShotModalState(null);
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
            onCancel={() => setTypeModalState(null)}
            onDone={(player, modifiers, type, secondPlayer, winner) => {
              commit(
                typeModalState.event,
                teamIdForEvent(typeModalState.event, player),
                player,
                null,
                undefined,
                null,
                { type, modifiers, secondPlayer, winner }
              );
              setTypeModalState(null);
            }}
          />
        ) : teamPickerState ? (
          <TeamPickerPanel
            title={`${teamPickerState.event.label} — select team`}
            teams={teams}
            onCancel={() => setTeamPickerState(null)}
            onDone={(teamId) => {
              commit(teamPickerState.event, teamId, null, null);
              setTeamPickerState(null);
            }}
          />
        ) : subOpen ? (
          <SubstitutionPanel
            teams={teams}
            lineup={lineup}
            onCancel={() => setSubOpen(false)}
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
            onCancel={() => setPlayNameModalState(null)}
            onDone={(name, outcome) => handlePickPlayName(playNameModalState.event, name, outcome)}
          />
        ) : (
          <ActionPanel
            live={live}
            onToggleLive={() => setLive((v) => !v)}
            onEventTriggered={handleEventTriggered}
            onShowMoreOther={() => setMoreOtherOpen(true)}
          />
        )}
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
          onCancel={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
