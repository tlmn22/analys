import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlertIcon } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RosterWithPlayer, SeasonTeamWithTeam } from "@/lib/types";
import type { RosterPlayer } from "../../types";
import { getReportHeaderInfo } from "../shared-data";
import { ReportHeader } from "../report-header";
import { elapsedSeconds } from "../game-summary/summary-stats";
import { DefenseQualityClient } from "./defense-quality-client";

export const dynamic = "force-dynamic";

export default async function DefenseQualityPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const info = await getReportHeaderInfo(gameId);
  if (!info) notFound();

  const db = supabaseAdmin();

  const [eventsRes, seasonTeamsRes] = await Promise.all([
    db
      .from("game_events")
      .select(
        "id, video_time, period, clock_time, event_type, team_id, player_id, defense_type, help_defense_type, boxout_type"
      )
      .eq("game_id", gameId),
    db
      .from("season_teams")
      .select("id, team_id")
      .eq("season_id", info.game.season_id)
      .in("team_id", [info.game.home_team_id, info.game.visitor_team_id])
      .returns<Pick<SeasonTeamWithTeam, "id" | "team_id">[]>(),
  ]);

  const seasonTeamIdByTeamId = new Map((seasonTeamsRes.data ?? []).map((st) => [st.team_id, st.id]));
  const homeStId = seasonTeamIdByTeamId.get(info.game.home_team_id);
  const visitorStId = seasonTeamIdByTeamId.get(info.game.visitor_team_id);
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

  const rows = eventsRes.data ?? [];

  const rawEvents = rows.map((e) => ({
    id: e.id as string,
    videoTime: Number(e.video_time),
    t: elapsedSeconds({ period: e.period as number, clockTime: Number(e.clock_time) }),
    period: e.period as number,
    eventType: e.event_type as string,
    teamId: e.team_id as string | null,
    playerId: e.player_id as string | null,
    assistPlayerId: null,
    points: null,
    shotType: null,
    shotX: null,
    shotY: null,
    andOne: false,
    defenseType: e.defense_type as string | null,
    helpDefenseType: e.help_defense_type as string | null,
    boxoutType: e.boxout_type as string | null,
  }));

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-[1600px]">
        <Link href="/admin/scouting-reports" className="text-sm text-blue-500 hover:underline">
          ← Scouting Reports
        </Link>
        <div className="mt-3">
          <ReportHeader
            gameId={gameId}
            icon={<ShieldAlertIcon className="size-7" />}
            title="Defense & Box Out"
            activeSlug="defense-quality"
            info={info}
          />
        </div>

        <div className="mt-8">
          <DefenseQualityClient
            videoUrl={info.game.video_url ?? ""}
            homeTeamId={info.game.home_team_id}
            visitorTeamId={info.game.visitor_team_id}
            homeTeamName={info.homeTeamName}
            visitorTeamName={info.visitorTeamName}
            homeRoster={homeRoster}
            visitorRoster={visitorRoster}
            rawEvents={rawEvents}
          />
        </div>
      </div>
    </div>
  );
}
