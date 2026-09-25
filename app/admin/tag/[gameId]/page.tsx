import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Game, RosterWithPlayer, SeasonTeamWithTeam, Team } from "@/lib/types";
import {
  STOPPED,
  OFFENSE,
  DEFENSE,
  OTHER,
  OTHER_MORE,
  OFFENSE_TEAM_SETS,
  DEFENSE_TEAM_SETS,
  AUTO_FLIP_TYPES,
  type EventColor,
  type EventSide,
} from "@/lib/tag-events";
import { TagWorkspace } from "./tag-workspace";
import { playerLabel, type RosterPlayer, type TaggedEvent, type TeamInfo } from "./types";

export const dynamic = "force-dynamic";

const ALL_EVENT_DEFS = [
  ...STOPPED,
  ...OFFENSE,
  ...DEFENSE,
  ...OTHER,
  ...OTHER_MORE,
  ...OFFENSE_TEAM_SETS,
  ...DEFENSE_TEAM_SETS,
];

const LABEL_BY_TYPE = new Map(ALL_EVENT_DEFS.map((e) => [e.type, e.label]));
LABEL_BY_TYPE.set("sub", "Sub");
LABEL_BY_TYPE.set("sub_in", "Sub");
LABEL_BY_TYPE.set("sub_out", "Sub");
LABEL_BY_TYPE.set("lineup_set", "Starter");

const COLOR_BY_TYPE = new Map<string, EventColor>(ALL_EVENT_DEFS.map((e) => [e.type, e.color]));
COLOR_BY_TYPE.set("sub", "gray");
COLOR_BY_TYPE.set("sub_in", "gray");
COLOR_BY_TYPE.set("sub_out", "gray");
COLOR_BY_TYPE.set("lineup_set", "gray");

const SIDE_BY_TYPE = new Map<string, EventSide>();
for (const e of ALL_EVENT_DEFS) if (e.side) SIDE_BY_TYPE.set(e.type, e.side);

export default async function TagPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const db = supabaseAdmin();

  const { data: gameRow, error: gameError } = await db
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError) {
    return <p className="p-6 text-sm text-destructive">Алдаа: {gameError.message}</p>;
  }
  if (!gameRow) notFound();
  const game = gameRow as Game;

  if (!game.video_url) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">
          Энэ тоглолтод YouTube URL тохируулагдаагүй байна.
        </p>
        <Link
          href={`/admin/seasons/${game.season_id}`}
          className="text-sm text-blue-500 hover:underline"
        >
          Улирлын хуудас руу буцах
        </Link>
      </div>
    );
  }

  const [teamsRes, seasonTeamsRes, lineupRes, eventsRes, offenseSetsRes, decisionRes] = await Promise.all([
    db
      .from("teams")
      .select("id, name")
      .in("id", [game.home_team_id, game.visitor_team_id])
      .returns<Pick<Team, "id" | "name">[]>(),
    db
      .from("season_teams")
      .select("id, team_id")
      .eq("season_id", game.season_id)
      .in("team_id", [game.home_team_id, game.visitor_team_id])
      .returns<Pick<SeasonTeamWithTeam, "id" | "team_id">[]>(),
    db.from("game_lineup").select("*").eq("game_id", gameId),
    db
      .from("game_events")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at", { ascending: false }),
    db.from("game_offense_sets").select("category, name").eq("game_id", gameId).order("created_at"),
    db.from("game_events").select("decision_quality").limit(0),
  ]);

  const teamsById = new Map((teamsRes.data ?? []).map((t) => [t.id, t]));
  const seasonTeamIdByTeamId = new Map(
    (seasonTeamsRes.data ?? []).map((st) => [st.team_id, st.id])
  );

  const homeStId = seasonTeamIdByTeamId.get(game.home_team_id);
  const visitorStId = seasonTeamIdByTeamId.get(game.visitor_team_id);
  const stIds = [homeStId, visitorStId].filter((x): x is string => !!x);

  const { data: rosterRows } = stIds.length
    ? await db
        .from("rosters")
        .select("season_team_id, number, player:players(id, first_name, last_name, position)")
        .in("season_team_id", stIds)
        .returns<RosterWithPlayer[]>()
    : { data: [] as RosterWithPlayer[] };

  function rosterFor(stId: string | undefined): RosterPlayer[] {
    if (!stId) return [];
    return (rosterRows ?? [])
      .filter((r) => r.season_team_id === stId)
      .map((r) => ({
        playerId: r.player.id,
        number: r.number,
        firstName: r.player.first_name,
        lastName: r.player.last_name,
        position: r.player.position,
      }))
      .sort((a, b) => a.number - b.number);
  }

  const homeTeam: TeamInfo = {
    id: game.home_team_id,
    name: teamsById.get(game.home_team_id)?.name ?? "Home",
    color: game.home_team_color,
    roster: rosterFor(homeStId),
  };
  const visitorTeam: TeamInfo = {
    id: game.visitor_team_id,
    name: teamsById.get(game.visitor_team_id)?.name ?? "Visitor",
    color: game.visitor_team_color,
    roster: rosterFor(visitorStId),
  };

  const rosterByPlayerId = new Map<string, RosterPlayer>();
  for (const p of [...homeTeam.roster, ...visitorTeam.roster]) rosterByPlayerId.set(p.playerId, p);

  const initialLineup: Record<string, (RosterPlayer | null)[]> = {
    [homeTeam.id]: [null, null, null, null, null],
    [visitorTeam.id]: [null, null, null, null, null],
  };
  for (const row of lineupRes.data ?? []) {
    const arr = initialLineup[row.team_id as string];
    if (arr && row.slot >= 1 && row.slot <= 5) {
      arr[row.slot - 1] = row.player_id ? (rosterByPlayerId.get(row.player_id) ?? null) : null;
    }
  }

  function playerLabelFor(id: string | null) {
    if (!id) return null;
    const p = rosterByPlayerId.get(id);
    return p ? playerLabel(p) : null;
  }

  const initialEvents: TaggedEvent[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    period: e.period,
    clockTime: Number(e.clock_time),
    videoTime: Number(e.video_time),
    eventType: e.event_type,
    decisionQuality: e.decision_quality ?? null,
    label: LABEL_BY_TYPE.get(e.event_type) ?? e.event_type,
    color: COLOR_BY_TYPE.get(e.event_type) ?? "gray",
    teamId: e.team_id,
    playerId: e.player_id,
    playerLabel: playerLabelFor(e.player_id),
    assistPlayerLabel: playerLabelFor(e.assist_player_id),
    points: e.points,
    keyEvent: !!e.key_event,
    shotType: e.shot_type,
    assistPlayerId: e.assist_player_id,
    shotDetails: /^(2pt|3pt)_(made|miss)$/.test(e.event_type) ? {
      shotType: e.shot_type ?? "", shotX: e.shot_x == null ? null : Number(e.shot_x), shotY: e.shot_y == null ? null : Number(e.shot_y),
      shotQuality: e.shot_quality, andOne: !!e.and_one, badMiss: !!e.bad_miss,
      contestedClose: !!e.contested_close, lateClock: !!e.late_clock, lightlyContested: !!e.lightly_contested,
      uncontested: !!e.uncontested, wideOpen: !!e.wide_open,
    } : undefined,
    defenderLabel: playerLabelFor(e.defender_player_id),
    assistType: e.assist_type,
    turnoverType: e.turnover_type,
    foulType: e.foul_type,
    screenSetType: e.screen_set_type,
    screenRcvdType: e.screen_rcvd_type,
    screenerLabel: playerLabelFor(e.screener_player_id),
    screenTargetLabel: playerLabelFor(e.screen_target_player_id),
    hustlePlayType: e.hustle_play_type,
    setOffenseName: e.set_offense_name,
    blobPlayName: e.blob_play_name,
    blobOutcome: e.blob_outcome,
    slobPlayName: e.slob_play_name,
    slobOutcome: e.slob_outcome,
    manToManType: e.man_to_man_type,
    zoneType: e.zone_type,
    pressType: e.press_type,
    offActionType: e.off_action_type,
    defCoverageType: e.def_coverage_type,
    defOffballType: e.def_offball_type,
    physicalContactType: e.physical_contact_type,
    physicalContactSecondLabel: playerLabelFor(e.physical_contact_second_player_id),
    physicalContactWinnerLabel: playerLabelFor(e.physical_contact_winner_player_id),
  }));

  const initialPlayNames: Record<string, string[]> = {};
  for (const row of offenseSetsRes.data ?? []) {
    const category = row.category as string;
    (initialPlayNames[category] ??= []).push(row.name as string);
  }

  // Resume state: reopening a game mid-tagging should pick up where the
  // analyst left off — same period, same video/clock position, and (best
  // effort) the same Off/Def assignment. initialEvents is newest-first, so
  // [0] is where tagging last stopped. Off/Def is inferred from the most
  // recent event that has a definite side, adjusted by one flip if that
  // event's type is one of the ones that auto-flips (see AUTO_FLIP_TYPES) —
  // this only looks at that single event, so it stays correct even though
  // past manual Off/Def swaps aren't recorded anywhere to replay.
  const mostRecentEvent = initialEvents[0];
  const endedQuarter = mostRecentEvent?.eventType === "end_quarter";
  const initialPeriod = (mostRecentEvent?.period ?? 1) + (endedQuarter ? 1 : 0);
  const initialClockTime = endedQuarter ? 600 : mostRecentEvent?.clockTime ?? 600;
  const initialVideoTime = mostRecentEvent?.videoTime ?? 0;

  let initialOffTeamId = homeTeam.id;
  const sideEvent = initialEvents.find((e) => e.teamId && SIDE_BY_TYPE.has(e.eventType));
  if (sideEvent) {
    const side = SIDE_BY_TYPE.get(sideEvent.eventType)!;
    const teamAtEvent = sideEvent.teamId!;
    const otherTeam = teamAtEvent === homeTeam.id ? visitorTeam.id : homeTeam.id;
    const flips = AUTO_FLIP_TYPES.has(sideEvent.eventType) && !sideEvent.shotDetails?.andOne;
    if (side === "off") {
      initialOffTeamId = flips ? otherTeam : teamAtEvent;
    } else {
      initialOffTeamId = flips ? teamAtEvent : otherTeam;
    }
  }
  const initialDefTeamId = initialOffTeamId === homeTeam.id ? visitorTeam.id : homeTeam.id;

  return (
    <TagWorkspace
      gameId={gameId}
      videoUrl={game.video_url}
      homeTeam={homeTeam}
      visitorTeam={visitorTeam}
      initialLineup={initialLineup}
      initialEvents={initialEvents}
      initialPlayNames={initialPlayNames}
      initialPeriod={initialPeriod}
      decisionEnabled={!decisionRes.error}
      initialClockTime={initialClockTime}
      initialVideoTime={initialVideoTime}
      initialOffTeamId={initialOffTeamId}
      initialDefTeamId={initialDefTeamId}
    />
  );
}
