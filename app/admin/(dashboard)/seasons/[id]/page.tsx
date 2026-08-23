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
import { GAME_TYPES } from "@/lib/types";
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
import { removeTeamFromSeason, deleteGame } from "./actions";
import { ArrowLeftIcon, PlusIcon, UsersIcon, PencilIcon, VideoIcon, FileBarChart2Icon } from "lucide-react";

function gameTypeLabel(value: string) {
  return GAME_TYPES.find((g) => g.value === value)?.label ?? value;
}

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
        "*, home_team:teams!games_home_team_id_fkey(id,name), visitor_team:teams!games_visitor_team_id_fkey(id,name)"
      )
      .eq("season_id", id)
      .order("game_date", { ascending: true, nullsFirst: false })
      .returns<GameWithTeams[]>(),
  ]);

  const queryError =
    teamsRes.error || allTeamsRes.error || allPlayersRes.error || gamesRes.error;
  if (queryError) {
    return <p className="text-sm text-destructive">Алдаа: {queryError.message}</p>;
  }

  const seasonTeams = teamsRes.data ?? [];
  const allTeams = allTeamsRes.data ?? [];
  const allPlayers = allPlayersRes.data ?? [];
  const games = gamesRes.data ?? [];

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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Home</TableHead>
                <TableHead>Visitor</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Тоглолт үүсгэгдээгүй байна
                  </TableCell>
                </TableRow>
              )}
              {games.map((game) => (
                <TableRow key={game.id}>
                  <TableCell>
                    {game.game_date
                      ? new Date(game.game_date).toLocaleString("mn-MN")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {game.home_team.name}
                    {game.home_team_color ? ` (${game.home_team_color})` : ""}
                  </TableCell>
                  <TableCell>
                    {game.visitor_team.name}
                    {game.visitor_team_color ? ` (${game.visitor_team_color})` : ""}
                  </TableCell>
                  <TableCell>{game.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{gameTypeLabel(game.game_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/tag/${game.id}`}>
                        <Button variant="ghost" size="icon-sm" title="Tag">
                          <VideoIcon />
                          <span className="sr-only">Tag</span>
                        </Button>
                      </Link>
                      <Link href={`/admin/tag/${game.id}/reports`}>
                        <Button variant="ghost" size="icon-sm" title="Reports">
                          <FileBarChart2Icon />
                          <span className="sr-only">Reports</span>
                        </Button>
                      </Link>
                      <GameFormDialog
                        seasonId={season.id}
                        teams={seasonTeamOptions}
                        game={game}
                        trigger={
                          <Button variant="ghost" size="icon-sm">
                            <PencilIcon />
                            <span className="sr-only">Засах</span>
                          </Button>
                        }
                      />
                      <DeleteButton
                        action={deleteGame.bind(null, game.id, season.id)}
                        confirmText="Энэ тоглолтыг устгах уу?"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
