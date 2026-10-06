import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  Season,
  SeasonTeamWithTeam,
  RosterWithPlayer,
  GameWithTeams,
  Team,
  Player,
} from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddTeamToSeasonDialog } from "@/components/admin/add-team-to-season-dialog";
import { RosterDialog } from "@/components/admin/roster-dialog";
import { GameFormDialog } from "@/components/admin/game-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { SeasonGamesTable } from "@/components/admin/season-games-table";
import { removeTeamFromSeason } from "./actions";
import { ArrowLeftIcon, PlusIcon, UsersIcon } from "lucide-react";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: seasonRow, error: seasonError } = await db
    .from("seasons")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (seasonError) {
    return <p className="text-sm text-destructive">Алдаа: {seasonError.message}</p>;
  }
  if (!seasonRow) notFound();
  const season = seasonRow as Season;

  const [teamsRes, allTeamsRes, allPlayersRes, gamesRes] = await Promise.all([
    db
      .from("season_teams")
      .select("*, team:teams(id,name,logo_url)")
      .eq("season_id", id)
      .order("created_at")
      .returns<SeasonTeamWithTeam[]>(),
    db
      .from("teams")
      .select("id, name, logo_url")
      .order("name")
      .returns<Pick<Team, "id" | "name" | "logo_url">[]>(),
    db
      .from("players")
      .select("id, first_name, last_name, photo_url, position")
      .order("first_name")
      .returns<Pick<Player, "id" | "first_name" | "last_name" | "photo_url" | "position">[]>(),
    db
      .from("games")
      .select(
        "*, home_team:teams!games_home_team_id_fkey(id,name), visitor_team:teams!games_visitor_team_id_fkey(id,name), game_events(count)"
      )
      .eq("season_id", id)
      .order("game_date", { ascending: true, nullsFirst: false })
      .returns<(GameWithTeams & { game_events: { count: number }[] })[]>(),
  ]);

  const queryError =
    teamsRes.error || allTeamsRes.error || allPlayersRes.error || gamesRes.error;
  if (queryError) {
    return <p className="text-sm text-destructive">Алдаа: {queryError.message}</p>;
  }

  const seasonTeams = teamsRes.data ?? [];
  const allTeams = allTeamsRes.data ?? [];
  const allPlayers = allPlayersRes.data ?? [];
  const games = (gamesRes.data ?? []).map(({ game_events, ...game }) => ({
    ...game,
    eventCount: game_events[0]?.count ?? 0,
  }));

  const seasonTeamIds = seasonTeams.map((st) => st.id);
  const { data: rosterRows } = seasonTeamIds.length
    ? await db
        .from("rosters")
        .select("*, player:players(id,first_name,last_name,photo_url,position)")
        .in("season_team_id", seasonTeamIds)
        .returns<RosterWithPlayer[]>()
    : { data: [] as RosterWithPlayer[] };

  const rostersBySeasonTeam = new Map<string, RosterWithPlayer[]>();
  for (const row of rosterRows ?? []) {
    const list = rostersBySeasonTeam.get(row.season_team_id) ?? [];
    list.push(row);
    rostersBySeasonTeam.set(row.season_team_id, list);
  }

  const registeredTeamIds = new Set(seasonTeams.map((st) => st.team_id));
  const availableTeams = allTeams.filter((t) => !registeredTeamIds.has(t.id));
  const seasonTeamOptions = seasonTeams.map((st) => st.team);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/seasons"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Улирлууд
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{season.name}</h1>
          <Badge variant={season.status === "active" ? "default" : "secondary"}>
            {season.status === "active" ? "Идэвхтэй" : "Идэвхгүй"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Багууд</h2>
          <AddTeamToSeasonDialog
            seasonId={season.id}
            availableTeams={availableTeams}
            trigger={
              <Button size="sm">
                <PlusIcon />
                Баг нэмэх
              </Button>
            }
          />
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Logo</TableHead>
                <TableHead>Баг</TableHead>
                <TableHead>Roster</TableHead>
                <TableHead className="w-32 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasonTeams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Энэ улиралд баг бүртгэгдээгүй байна
                  </TableCell>
                </TableRow>
              )}
              {seasonTeams.map((st) => {
                const roster = rostersBySeasonTeam.get(st.id) ?? [];
                const rosterPlayerIds = new Set(roster.map((r) => r.player_id));
                const availablePlayers = allPlayers.filter(
                  (p) => !rosterPlayerIds.has(p.id)
                );
                return (
                  <TableRow key={st.id}>
                    <TableCell>
                      {st.team.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={st.team.logo_url}
                          alt={st.team.name}
                          className="size-9 rounded-md border object-cover"
                        />
                      ) : (
                        <div className="size-9 rounded-md border bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{st.team.name}</TableCell>
                    <TableCell>{roster.length} тоглогч</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <RosterDialog
                          seasonTeamId={st.id}
                          seasonId={season.id}
                          teamName={st.team.name}
                          roster={roster}
                          availablePlayers={availablePlayers}
                          trigger={
                            <Button variant="ghost" size="icon-sm">
                              <UsersIcon />
                              <span className="sr-only">Roster</span>
                            </Button>
                          }
                        />
                        <DeleteButton
                          action={removeTeamFromSeason.bind(null, st.id, season.id)}
                          confirmText={`"${st.team.name}" багийг энэ улирлаас хасах уу? (roster устана)`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Тоглолтууд</h2>
          <GameFormDialog
            seasonId={season.id}
            teams={seasonTeamOptions}
            trigger={
              <Button size="sm" disabled={seasonTeamOptions.length < 2}>
                <PlusIcon />
                Тоглолт нэмэх
              </Button>
            }
          />
        </div>
        {seasonTeamOptions.length < 2 && (
          <p className="text-sm text-muted-foreground">
            Тоглолт үүсгэхийн тулд наад зах нь 2 баг бүртгэнэ үү.
          </p>
        )}
        <SeasonGamesTable seasonId={season.id} games={games} teams={seasonTeamOptions} />
      </div>
    </div>
  );
}
