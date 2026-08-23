"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { GameType } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const VALID_GAME_TYPES: GameType[] = [
  "league",
  "division",
  "non_conference",
  "tournament",
  "playoff",
  "pre_season",
  "scrimmage",
];

// --- Season <-> Team registration ---------------------------------------

export async function addTeamToSeason(
  seasonId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const team_id = String(formData.get("team_id") || "");
  if (!team_id) return { error: "Баг сонгоно уу" };

  const { error } = await supabaseAdmin()
    .from("season_teams")
    .insert({ season_id: seasonId, team_id });

  if (error) return { error: error.message };

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: true };
}

export async function removeTeamFromSeason(seasonTeamId: string, seasonId: string) {
  await supabaseAdmin().from("season_teams").delete().eq("id", seasonTeamId);
  revalidatePath(`/admin/seasons/${seasonId}`);
}

// --- Roster ---------------------------------------------------------------

export async function addPlayerToRoster(
  seasonTeamId: string,
  seasonId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const player_id = String(formData.get("player_id") || "");
  const number = Number(formData.get("number"));

  if (!player_id) return { error: "Тоглогч сонгоно уу" };
  if (!Number.isInteger(number) || number < 0) {
    return { error: "Дугаар зөв тоо байх ёстой" };
  }

  const { error } = await supabaseAdmin()
    .from("rosters")
    .insert({ season_team_id: seasonTeamId, player_id, number });

  if (error) return { error: error.message };

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: true };
}

export async function removeFromRoster(rosterId: string, seasonId: string) {
  await supabaseAdmin().from("rosters").delete().eq("id", rosterId);
  revalidatePath(`/admin/seasons/${seasonId}`);
}

// --- Games ------------------------------------------------------------

function parseGameInput(formData: FormData) {
  const home_team_id = String(formData.get("home_team_id") || "");
  const visitor_team_id = String(formData.get("visitor_team_id") || "");
  const home_team_color = String(formData.get("home_team_color") || "").trim() || null;
  const visitor_team_color = String(formData.get("visitor_team_color") || "").trim() || null;
  const location = String(formData.get("location") || "").trim() || null;
  const game_type = String(formData.get("game_type") || "");
  const game_date_raw = String(formData.get("game_date") || "");
  const game_date = game_date_raw ? new Date(game_date_raw).toISOString() : null;
  const video_url = String(formData.get("video_url") || "").trim() || null;

  if (!home_team_id) return { error: "Home team сонгоно уу" as const };
  if (!visitor_team_id) return { error: "Visitor team сонгоно уу" as const };
  if (home_team_id === visitor_team_id) {
    return { error: "Home болон Visitor баг ялгаатай байх ёстой" as const };
  }
  if (!VALID_GAME_TYPES.includes(game_type as GameType)) {
    return { error: "Game type сонгоно уу" as const };
  }

  return {
    home_team_id,
    visitor_team_id,
    home_team_color,
    visitor_team_color,
    location,
    game_type: game_type as GameType,
    game_date,
    video_url,
  };
}

export async function createGame(
  seasonId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseGameInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin()
    .from("games")
    .insert({ ...parsed, season_id: seasonId });

  if (error) return { error: error.message };

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: true };
}

export async function updateGame(
  id: string,
  seasonId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseGameInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin().from("games").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/seasons/${seasonId}`);
  return { success: true };
}

export async function deleteGame(id: string, seasonId: string) {
  await supabaseAdmin().from("games").delete().eq("id", id);
  revalidatePath(`/admin/seasons/${seasonId}`);
}
