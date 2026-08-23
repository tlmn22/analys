import { supabaseAdmin } from "@/lib/supabase/server";
import type { Game, Team } from "@/lib/types";

export interface ReportHeaderInfo {
  game: Game;
  homeTeamName: string;
  visitorTeamName: string;
  homeScore: number;
  visitorScore: number;
}

/** Every report page needs the same game/team/score header — fetched once
 * here rather than duplicated per report. Returns null if the game doesn't
 * exist (caller should notFound()). */
export async function getReportHeaderInfo(gameId: string): Promise<ReportHeaderInfo | null> {
  const db = supabaseAdmin();

  const { data: gameRow } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (!gameRow) return null;
  const game = gameRow as Game;

  const [teamsRes, eventsRes] = await Promise.all([
    db
      .from("teams")
      .select("id, name")
      .in("id", [game.home_team_id, game.visitor_team_id])
      .returns<Pick<Team, "id" | "name">[]>(),
    db.from("game_events").select("team_id, points").eq("game_id", gameId),
  ]);

  const teamsById = new Map((teamsRes.data ?? []).map((t) => [t.id, t]));
  const scores: Record<string, number> = { [game.home_team_id]: 0, [game.visitor_team_id]: 0 };
  for (const e of eventsRes.data ?? []) {
    if (e.team_id && e.points) scores[e.team_id] = (scores[e.team_id] ?? 0) + e.points;
  }

  return {
    game,
    homeTeamName: teamsById.get(game.home_team_id)?.name ?? "Home",
    visitorTeamName: teamsById.get(game.visitor_team_id)?.name ?? "Visitor",
    homeScore: scores[game.home_team_id] ?? 0,
    visitorScore: scores[game.visitor_team_id] ?? 0,
  };
}
