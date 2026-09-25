"use server";

import { requireSuperadmin } from "@/lib/club-event-access";

import { supabaseAdmin } from "@/lib/supabase/server";
import { eventDetailCleanup } from "./event-detail-cleanup";
import { normalizeDecisionQuality, type DecisionQuality } from "@/lib/decision-quality";

export interface TagEventInput {
  decisionQuality?: DecisionQuality;
  id?: string;
  gameId: string;
  period: number;
  clockTime: number;
  videoTime: number;
  eventType: string;
  label: string;
  teamId: string | null;
  playerId: string | null;
  assistPlayerId: string | null;
  defenderPlayerId?: string | null;
  screenerPlayerId?: string | null;
  screenTargetPlayerId?: string | null;
  assistType?: string | null;
  turnoverType?: string | null;
  screenSetType?: string | null;
  screenRcvdType?: string | null;
  hustlePlayType?: string | null;
  setOffenseName?: string | null;
  blobPlayName?: string | null;
  blobOutcome?: string | null;
  slobPlayName?: string | null;
  slobOutcome?: string | null;
  manToManType?: string | null;
  zoneType?: string | null;
  pressType?: string | null;
  offActionType?: string | null;
  defCoverageType?: string | null;
  defOffballType?: string | null;
  physicalContactType?: string | null;
  physicalContactSecondPlayerId?: string | null;
  physicalContactWinnerPlayerId?: string | null;
  boxoutType?: string | null;
  foulDetails?: {
    type: string;
    fiftyFifty: boolean;
    badCall: boolean;
    correctCall: boolean;
  };
  points: number | null;
  shotDetails?: {
    andOne: boolean;
    badMiss: boolean;
    contestedClose: boolean;
    lateClock: boolean;
    lightlyContested: boolean;
    uncontested: boolean;
    wideOpen: boolean;
    shotQuality: number | null;
    shotType: string;
    shotX: number | null;
    shotY: number | null;
  };
}

export async function tagEvent(
  input: TagEventInput
): Promise<{ id: string } | { error: string }> {
  await requireSuperadmin();
  if (!Number.isInteger(input.period) || input.period < 1 || !Number.isFinite(input.clockTime) || input.clockTime < 0 || !Number.isFinite(input.videoTime) || input.videoTime < 0) return { error: "Үе болон цагийн утга буруу байна." };
  const d = input.shotDetails;
  const f = input.foulDetails;
  const { data, error } = await supabaseAdmin()
    .from("game_events")
    .upsert({
      ...(input.id && { id: input.id }),
      game_id: input.gameId,
      period: input.period,
      clock_time: input.clockTime,
      video_time: input.videoTime,
      event_type: input.eventType,
      ...(input.decisionQuality !== undefined && { decision_quality: normalizeDecisionQuality(input.eventType, input.playerId, input.decisionQuality) }),
      team_id: input.teamId,
      player_id: input.playerId,
      assist_player_id: input.assistPlayerId,
      defender_player_id: input.defenderPlayerId ?? null,
      screener_player_id: input.screenerPlayerId ?? null,
      screen_target_player_id: input.screenTargetPlayerId ?? null,
      assist_type: input.assistType ?? null,
      turnover_type: input.turnoverType ?? null,
      screen_set_type: input.screenSetType ?? null,
      screen_rcvd_type: input.screenRcvdType ?? null,
      hustle_play_type: input.hustlePlayType ?? null,
      set_offense_name: input.setOffenseName ?? null,
      blob_play_name: input.blobPlayName ?? null,
      blob_outcome: input.blobOutcome ?? null,
      slob_play_name: input.slobPlayName ?? null,
      slob_outcome: input.slobOutcome ?? null,
      man_to_man_type: input.manToManType ?? null,
      zone_type: input.zoneType ?? null,
      press_type: input.pressType ?? null,
      off_action_type: input.offActionType ?? null,
      def_coverage_type: input.defCoverageType ?? null,
      def_offball_type: input.defOffballType ?? null,
      physical_contact_type: input.physicalContactType ?? null,
      physical_contact_second_player_id: input.physicalContactSecondPlayerId ?? null,
      physical_contact_winner_player_id: input.physicalContactWinnerPlayerId ?? null,
      boxout_type: input.boxoutType ?? null,
      points: input.points,
      ...(d && {
        shot_type: d.shotType || null,
        and_one: d.andOne,
        bad_miss: d.badMiss,
        contested_close: d.contestedClose,
        late_clock: d.lateClock,
        lightly_contested: d.lightlyContested,
        uncontested: d.uncontested,
        wide_open: d.wideOpen,
        shot_quality: d.shotQuality,
        shot_x: d.shotX,
        shot_y: d.shotY,
      }),
      ...(f && {
        foul_type: f.type || null,
        foul_fifty_fifty: f.fiftyFifty,
        foul_bad_call: f.badCall,
        foul_correct_call: f.correctCall,
      }),
    }, { onConflict: "id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data && input.id) return { id: input.id };
  return { id: data!.id as string };
}

// Maps an event type to the single DB column its "type" dropdown value
// belongs to — see lib/tag-events.ts's TYPE_OPTIONS_BY_EVENT/
// FREE_TEXT_TYPE_EVENTS for the client-side equivalent. Every other detail
// column is explicitly cleared on update so switching event types doesn't
// leave stale data behind from whatever the event used to be.
const TYPE_DB_COLUMN: Record<string, string> = {
  boxout: "boxout_type",
  turnover: "turnover_type",
  off_foul: "foul_type",
  def_foul: "foul_type",
  screen_set: "screen_set_type",
  screen_rcvd: "screen_rcvd_type",
  hustle_play: "hustle_play_type",
  set_offense: "set_offense_name",
  blob: "blob_play_name",
  slob: "slob_play_name",
  man_to_man: "man_to_man_type",
  zone: "zone_type",
  press: "press_type",
  physical_contact: "physical_contact_type",
  other_assist: "assist_type",
  off_action: "off_action_type",
  def_coverage: "def_coverage_type",
  def_offball: "def_offball_type",
};

export interface UpdateEventInput {
  decisionQuality?: DecisionQuality;
  id: string;
  eventType: string;
  teamId: string | null;
  playerId: string | null;
  points: number | null;
  videoTime: number;
  clockTime: number;
  keyEvent: boolean;
  typeValue: string | null;
}

export async function updateEvent(input: UpdateEventInput): Promise<{ error?: string }> {
  await requireSuperadmin();
  const detailColumns: Record<string, string | null> = {
    turnover_type: null,
    foul_type: null,
    screen_set_type: null,
    screen_rcvd_type: null,
    hustle_play_type: null,
    set_offense_name: null,
    blob_play_name: null,
    slob_play_name: null,
    man_to_man_type: null,
    zone_type: null,
    press_type: null,
    physical_contact_type: null,
    assist_type: null,
    boxout_type: null,
    off_action_type: null,
    def_coverage_type: null,
    def_offball_type: null,
  };
  const column = TYPE_DB_COLUMN[input.eventType];
  if (column) detailColumns[column] = input.typeValue;

  const { error } = await supabaseAdmin()
    .from("game_events")
    .update({
      event_type: input.eventType,
      team_id: input.teamId,
      player_id: input.playerId,
      points: input.points,
      video_time: input.videoTime,
      clock_time: input.clockTime,
      key_event: input.keyEvent,
      ...(input.decisionQuality !== undefined && { decision_quality: normalizeDecisionQuality(input.eventType, input.playerId, input.decisionQuality) }),
      ...detailColumns,
      ...eventDetailCleanup(input.eventType).database,
    })
    .eq("id", input.id);

  if (error) return { error: error.message };
  return {};
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  await requireSuperadmin();
  const { error } = await supabaseAdmin().from("game_events").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function addPlayName(
  gameId: string,
  category: string,
  name: string
): Promise<{ error?: string }> {
  await requireSuperadmin();
  const { error } = await supabaseAdmin()
    .from("game_offense_sets")
    .upsert(
      { game_id: gameId, category, name },
      { onConflict: "game_id,category,name", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };
  return {};
}

export async function setLineupBulk(
  gameId: string,
  teamId: string,
  playerIds: string[]
): Promise<{ error?: string }> {
  await requireSuperadmin();
  const rows = playerIds.map((playerId, i) => ({
    game_id: gameId,
    team_id: teamId,
    slot: i + 1,
    player_id: playerId,
  }));

  const { error } = await supabaseAdmin()
    .from("game_lineup")
    .upsert(rows, { onConflict: "game_id,team_id,slot" });

  if (error) return { error: error.message };
  return {};
}

export async function setLineupSlot(
  gameId: string,
  teamId: string,
  slot: number,
  playerId: string
): Promise<{ previousPlayerId: string | null; error?: string }> {
  await requireSuperadmin();
  const db = supabaseAdmin();

  const { data: existing } = await db
    .from("game_lineup")
    .select("player_id")
    .eq("game_id", gameId)
    .eq("team_id", teamId)
    .eq("slot", slot)
    .maybeSingle();

  const { error } = await db
    .from("game_lineup")
    .upsert(
      { game_id: gameId, team_id: teamId, slot, player_id: playerId },
      { onConflict: "game_id,team_id,slot" }
    );

  if (error) return { previousPlayerId: null, error: error.message };
  return { previousPlayerId: (existing?.player_id as string | undefined) ?? null };
}

// Idempotent so a failed/ambiguous response can be retried without duplicate slots.
export async function restoreLineup(gameId: string, teamId: string, playerIds: (string | null)[]) {
  await requireSuperadmin();
  if (playerIds.length !== 5 || new Set(playerIds.filter(Boolean)).size !== playerIds.filter(Boolean).length) return { error: "Бүрэлдэхүүнд давхардсан тоглогч байна." };
  const db = supabaseAdmin();
  const { data: game, error: gameError } = await db.from("games").select("season_id, home_team_id, visitor_team_id").eq("id", gameId).single();
  if (gameError || !game || ![game.home_team_id, game.visitor_team_id].includes(teamId)) return { error: "Баг олдсонгүй." };
  const { data: seasonTeam, error: teamError } = await db.from("season_teams").select("id").eq("season_id", game.season_id).eq("team_id", teamId).single();
  if (teamError || !seasonTeam) return { error: "Багийн roster олдсонгүй." };
  const { data: roster, error: rosterError } = await db.from("rosters").select("player_id").eq("season_team_id", seasonTeam.id);
  if (rosterError) return { error: rosterError.message };
  const allowed = new Set((roster ?? []).map(p => p.player_id));
  if (playerIds.some(id => id && !allowed.has(id))) return { error: "Тоглогч энэ багийн бүрэлдэхүүнд байхгүй." };
  const { error } = await db.from("game_lineup").upsert(playerIds.map((player_id, index) => ({ game_id: gameId, team_id: teamId, slot: index + 1, player_id })), { onConflict: "game_id,team_id,slot" });
  return error ? { error: error.message } : {};
}

export async function undoTagEvents(gameId: string, ids: string[]) {
  await requireSuperadmin();
  if (!ids.length || ids.length > 20) return { error: "Буцаах event буруу байна." };
  const { error } = await supabaseAdmin().from("game_events").delete().eq("game_id", gameId).in("id", ids);
  return error ? { error: error.message } : {};
}

