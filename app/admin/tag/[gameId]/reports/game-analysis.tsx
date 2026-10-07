import { supabaseAdmin } from "@/lib/supabase/server";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";
import { parseAnalysis } from "@/lib/game-analysis";
import { GameAnalysisCard, type AnalysisPlayer, type AnalysisTeam } from "@/components/admin/game-analysis-card";
import { elapsedSeconds } from "./game-summary/summary-stats";
import { computePossessions } from "./game-summary/pace-stats";
import { computeFourFactors, computePeriodScores } from "./game-analysis-stats";

type EventRow = { period: number; clock_time: number; event_type: string; team_id: string | null; points: number | null };

/** The game's saved expert analysis, or nothing if none has been written. */
export async function GameAnalysis({ gameId }: { gameId: string }) {
  const db = supabaseAdmin();
  const { data, error } = await db.from("game_analyses").select("content,updated_at").eq("game_id", gameId).maybeSingle();
  const doc = !error && data ? parseAnalysis(data.content) : null;
  if (!doc) return null;

  const { data: game } = await db.from("games").select("season_id,home_team_id,visitor_team_id").eq("id", gameId).maybeSingle();
  if (!game) return null;
  const [regsRes, events] = await Promise.all([
    db.from("season_teams").select("id,team:teams(id,name,logo_url)").eq("season_id", game.season_id).in("team_id", [game.home_team_id, game.visitor_team_id]),
    loadEvents(gameId),
  ]);
  const regs = (regsRes.data ?? []) as unknown as { id: string; team: { id: string; name: string; logo_url: string | null } }[];
  const { data: rosterRows } = regs.length
    ? await db.from("rosters").select("season_team_id,number,player:players(id,first_name,last_name,photo_url)").in("season_team_id", regs.map((r) => r.id))
    : { data: [] };

  const raw = events.map((e) => ({
    period: e.period,
    t: elapsedSeconds({ period: e.period, clockTime: Number(e.clock_time) }),
    eventType: e.event_type,
    teamId: e.team_id,
    points: e.points,
  }));
  const H = game.home_team_id, V = game.visitor_team_id;
  const possessions = computePossessions(raw, H, V);
  const tripsOf = (team: string) => possessions.filter((p) => p.teamId === team).length;
  const score = (team: string) => raw.reduce((s, e) => s + (e.teamId === team ? e.points ?? 0 : 0), 0);
  const teamFor = (id: string): AnalysisTeam => {
    const team = regs.find((r) => r.team.id === id)?.team;
    return { id, name: team?.name ?? "—", logoUrl: team?.logo_url ?? null, score: score(id) };
  };
  const teamIdBySeasonTeam = new Map(regs.map((r) => [r.id, r.team.id]));
  const playersById: Record<string, AnalysisPlayer> = {};
  for (const row of (rosterRows ?? []) as unknown as { season_team_id: string; number: number; player: { id: string; first_name: string; last_name: string; photo_url: string | null } }[]) {
    playersById[row.player.id] = {
      id: row.player.id,
      number: row.number,
      name: `${row.player.first_name} ${row.player.last_name}`,
      photoUrl: row.player.photo_url,
      teamId: teamIdBySeasonTeam.get(row.season_team_id) ?? "",
    };
  }

  return (
    <GameAnalysisCard
      doc={doc}
      updatedAt={`${calendarDay(data!.updated_at)} ${calendarTime(data!.updated_at)}`}
      home={teamFor(H)}
      visitor={teamFor(V)}
      quarters={computePeriodScores(raw, H, V)}
      fourFactors={{ home: computeFourFactors(raw, H, V, tripsOf(H)), visitor: computeFourFactors(raw, V, H, tripsOf(V)) }}
      playersById={playersById}
    />
  );
}

async function loadEvents(gameId: string): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin().from("game_events").select("period,clock_time,event_type,team_id,points")
      .eq("game_id", gameId).order("id").range(offset, offset + 999);
    if (error) break;
    rows.push(...((data ?? []) as EventRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }
  return rows;
}
