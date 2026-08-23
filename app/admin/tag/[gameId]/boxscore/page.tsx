import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Game, RosterWithPlayer, SeasonTeamWithTeam, Team } from "@/lib/types";
import type { RosterPlayer } from "../types";
import { computeBoxScore, type PlayerBoxScore, type RawGameEvent } from "./stats";
import { BoxscoreTables } from "./boxscore-table";

export const dynamic = "force-dynamic";

export default async function BoxscorePage({
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

  const [teamsRes, seasonTeamsRes, eventsRes] = await Promise.all([
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
    db
      .from("game_events")
      .select("period, clock_time, event_type, team_id, player_id, assist_player_id")
      .eq("game_id", gameId),
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

  const homeRoster = rosterFor(homeStId);
  const visitorRoster = rosterFor(visitorStId);

  const rawEvents: RawGameEvent[] = (eventsRes.data ?? []).map((e) => ({
    period: e.period as number,
    clockTime: Number(e.clock_time),
    eventType: e.event_type as string,
    teamId: e.team_id as string | null,
    playerId: e.player_id as string | null,
    assistPlayerId: e.assist_player_id as string | null,
  }));

  const statsMap = computeBoxScore(rawEvents, game.home_team_id, game.visitor_team_id);
  const stats: Record<string, PlayerBoxScore> = Object.fromEntries(statsMap);

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/admin/tag/${gameId}`} className="text-sm text-blue-500 hover:underline">
          ← Tag руу буцах
        </Link>
        <h1 className="text-lg font-semibold">
          Boxscore — {teamsById.get(game.home_team_id)?.name ?? "Home"} vs{" "}
          {teamsById.get(game.visitor_team_id)?.name ?? "Visitor"}
        </h1>
      </div>
      <BoxscoreTables
        homeTeam={{
          id: game.home_team_id,
          name: teamsById.get(game.home_team_id)?.name ?? "Home",
          roster: homeRoster,
        }}
        visitorTeam={{
          id: game.visitor_team_id,
          name: teamsById.get(game.visitor_team_id)?.name ?? "Visitor",
          roster: visitorRoster,
        }}
        stats={stats}
      />
    </div>
  );
}
