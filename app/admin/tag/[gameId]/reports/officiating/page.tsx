import Link from "next/link";
import { notFound } from "next/navigation";
import { GavelIcon } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getReportHeaderInfo } from "../shared-data";
import { ReportHeader } from "../report-header";
import { elapsedSeconds } from "../game-summary/summary-stats";
import { OfficiatingClient } from "./officiating-client";

export const dynamic = "force-dynamic";

export default async function OfficiatingPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const info = await getReportHeaderInfo(gameId);
  if (!info) notFound();

  const { data: eventsRes } = await supabaseAdmin()
    .from("game_events")
    .select(
      "id, video_time, period, clock_time, event_type, team_id, player_id, points, foul_type, foul_fifty_fifty, foul_bad_call, foul_correct_call"
    )
    .eq("game_id", gameId);

  const rows = eventsRes ?? [];

  const rawEvents = rows.map((e) => ({
    id: e.id as string,
    videoTime: Number(e.video_time),
    t: elapsedSeconds({ period: e.period as number, clockTime: Number(e.clock_time) }),
    period: e.period as number,
    eventType: e.event_type as string,
    teamId: e.team_id as string | null,
    playerId: e.player_id as string | null,
    assistPlayerId: null,
    points: e.points as number | null,
    shotType: null,
    shotX: null,
    shotY: null,
    andOne: false,
    foulType: e.foul_type as string | null,
    foulFiftyFifty: !!e.foul_fifty_fifty,
    foulBadCall: !!e.foul_bad_call,
    foulCorrectCall: !!e.foul_correct_call,
  }));

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-[1600px]">
        <Link href={`/admin/tag/${gameId}`} className="text-sm text-blue-500 hover:underline">
          ← Tag руу буцах
        </Link>
        <div className="mt-3">
          <ReportHeader
            gameId={gameId}
            icon={<GavelIcon className="size-7" />}
            title="Officiating"
            activeSlug="officiating"
            info={info}
          />
        </div>

        <div className="mt-8">
          <OfficiatingClient
            videoUrl={info.game.video_url ?? ""}
            homeTeamId={info.game.home_team_id}
            visitorTeamId={info.game.visitor_team_id}
            homeTeamName={info.homeTeamName}
            visitorTeamName={info.visitorTeamName}
            rawEvents={rawEvents}
          />
        </div>
      </div>
    </div>
  );
}
