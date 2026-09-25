import Link from "next/link";
import { notFound } from "next/navigation";
import { UserIcon } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getReportHeaderInfo } from "../shared-data";
import { ReportHeader } from "../report-header";
import { elapsedSeconds } from "../game-summary/summary-stats";
import { CoachingStatsClient } from "./coaching-stats-client";

export const dynamic = "force-dynamic";

export default async function CoachingStatsPage({
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
      "id, video_time, period, clock_time, event_type, team_id, points, and_one, man_to_man_type, zone_type, press_type"
    )
    .eq("game_id", gameId);

  const rows = eventsRes ?? [];
  const maxPeriod = rows.length ? Math.max(...rows.map((e) => e.period as number)) : 1;

  const rawEvents = rows.map((e) => ({
    id: e.id as string,
    videoTime: Number(e.video_time),
    t: elapsedSeconds({ period: e.period as number, clockTime: Number(e.clock_time) }),
    period: e.period as number,
    eventType: e.event_type as string,
    teamId: e.team_id as string | null,
    playerId: null,
    assistPlayerId: null,
    points: e.points as number | null,
    shotType: null,
    shotX: null,
    shotY: null,
    andOne: !!e.and_one,
    manToManType: e.man_to_man_type as string | null,
    zoneType: e.zone_type as string | null,
    pressType: e.press_type as string | null,
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
            icon={<UserIcon className="size-7" />}
            title="Coaching Stats"
            activeSlug="coaching-stats"
            info={info}
          />
        </div>

        <div className="mt-8">
          <CoachingStatsClient
            videoUrl={info.game.video_url ?? ""}
            homeTeamId={info.game.home_team_id}
            visitorTeamId={info.game.visitor_team_id}
            homeTeamName={info.homeTeamName}
            visitorTeamName={info.visitorTeamName}
            rawEvents={rawEvents}
            maxSeconds={maxPeriod * 600}
          />
        </div>
      </div>
    </div>
  );
}
