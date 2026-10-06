import Link from "next/link";
import { redirect } from "next/navigation";
import { VideoOffIcon } from "lucide-react";
import { getEventEditor } from "@/lib/club-event-access";
import { FULL_GAME_SEASON_ID } from "@/lib/scouting-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";
import { extractVideoId } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TeamRow = { id: string; name: string; logo_url: string | null };
type GameRow = { id: string; home_team_id: string; visitor_team_id: string; game_date: string | null; video_url: string | null };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

function Logo({ team, size }: { team: TeamRow | undefined; size: number }) {
  if (team?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt={team.name} className="shrink-0 rounded-md object-contain" style={{ width: size, height: size }} />;
  }
  return <div className="flex shrink-0 items-center justify-center rounded-md border border-dashed text-[10px] font-semibold text-muted-foreground" style={{ width: size, height: size }}>
    {(team?.name ?? "?").slice(0, 3).toUpperCase()}
  </div>;
}

export default async function FullGamesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");

  const db = supabaseAdmin();
  const [season, registrations, gamesRes] = await Promise.all([
    db.from("seasons").select("name").eq("id", FULL_GAME_SEASON_ID).maybeSingle(),
    db.from("season_teams").select("team:teams(id,name,logo_url)").eq("season_id", FULL_GAME_SEASON_ID),
    db.from("games").select("id,home_team_id,visitor_team_id,game_date,video_url").eq("season_id", FULL_GAME_SEASON_ID)
      .order("game_date", { ascending: true, nullsFirst: false }).order("id"),
  ]);
  if (season.error || registrations.error || gamesRes.error) return <p role="alert">Тоглолтуудыг ачаалж чадсангүй.</p>;

  const teams = ((registrations.data ?? []) as unknown as { team: TeamRow | null }[])
    .map((r) => r.team).filter((t): t is TeamRow => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, "mn"));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const games = (gamesRes.data ?? []) as GameRow[];
  const selectedTeam = uuid.test(one("team")) ? teamById.get(one("team")) : undefined;
  // No team picked shows every game of the season.
  const teamGames = selectedTeam ? games.filter((g) => g.home_team_id === selectedTeam.id || g.visitor_team_id === selectedTeam.id) : games;
  const videoCount = (teamId: string) => games.filter((g) => g.video_url && (g.home_team_id === teamId || g.visitor_team_id === teamId)).length;

  // Final scores from tagged points; games not tagged yet show no score.
  const scores = new Map<string, Map<string, number>>();
  if (teamGames.length) {
    const ids = teamGames.map((g) => g.id);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("game_events").select("game_id,team_id,points").in("game_id", ids).not("points", "is", null).order("id").range(offset, offset + 999);
      if (error) break;
      for (const e of data ?? []) {
        const byTeam = scores.get(e.game_id) ?? new Map<string, number>();
        byTeam.set(e.team_id, (byTeam.get(e.team_id) ?? 0) + (e.points ?? 0));
        scores.set(e.game_id, byTeam);
      }
      if ((data?.length ?? 0) < 1000) break;
    }
  }

  const href = (team?: string) => (team ? `/admin/full-games?team=${team}` : "/admin/full-games");
  const withVideo = teamGames.filter((g) => g.video_url);
  const withoutVideo = teamGames.filter((g) => !g.video_url);
  const gameNumber = new Map(teamGames.map((g, i) => [g.id, i + 1]));

  function GameCaption({ game }: { game: GameRow }) {
    const score = scores.get(game.id);
    const day = game.game_date ? calendarDay(game.game_date) : null;
    const when = day ? `${day} · ${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} · ${calendarTime(game.game_date!)}` : "Огноо товлоогүй";
    const number = <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{gameNumber.get(game.id)}</span>;
    if (!selectedTeam) {
      const home = teamById.get(game.home_team_id);
      const visitor = teamById.get(game.visitor_team_id);
      return <div className="flex items-center gap-3">
        {number}
        <Logo team={home} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{home?.name ?? "Home"} <span className="text-muted-foreground">vs</span> {visitor?.name ?? "Visitor"}</span>
          <span className="block text-xs text-muted-foreground">{when}</span>
        </span>
        {score && <span className="font-mono text-sm font-semibold tabular-nums">{score.get(game.home_team_id) ?? 0}–{score.get(game.visitor_team_id) ?? 0}</span>}
        <Logo team={visitor} size={28} />
      </div>;
    }
    const home = game.home_team_id === selectedTeam.id;
    const opponent = teamById.get(home ? game.visitor_team_id : game.home_team_id);
    const ours = score?.get(selectedTeam.id) ?? 0;
    const theirs = score?.get(opponent?.id ?? "") ?? 0;
    return <div className="flex items-center gap-3">
      {number}
      <Logo team={opponent} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{home ? "vs" : "@"} {opponent?.name ?? "Өрсөлдөгч"}</span>
        <span className="block text-xs text-muted-foreground">{when} · {home ? "Home" : "Away"}</span>
      </span>
      {score && <span className={cn("font-mono text-sm font-semibold tabular-nums", ours > theirs ? "text-emerald-600" : ours < theirs ? "text-red-600" : "")}>{ours}–{theirs}</span>}
    </div>;
  }

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold">Full Game</h1>
      <p className="mt-2 text-sm text-muted-foreground">{season.data?.name ?? "Улирал"} · Багаа сонгоод тоглолтын бүтэн бичлэгийг үзээрэй.</p>
    </header>

    <nav aria-label="Багууд" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      <Link href={href()} aria-current={!selectedTeam ? "page" : undefined}
        className={cn("flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-card p-2 text-center transition-colors hover:border-emerald-600 lg:min-w-0 lg:flex-1",
          !selectedTeam && "border-emerald-600 ring-2 ring-emerald-600/30")}>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-xs font-bold">ALL</span>
        <span className="text-[11px] font-medium leading-tight">Бүгд</span>
        <span className="text-[10px] text-muted-foreground">{games.filter((g) => g.video_url).length} бичлэг</span>
      </Link>
      {teams.map((team) => {
        const active = team.id === selectedTeam?.id;
        return <Link key={team.id} href={href(team.id)} aria-current={active ? "page" : undefined} title={team.name}
          className={cn("flex w-20 shrink-0 flex-col items-center gap-1 rounded-lg border bg-card p-2 text-center transition-colors hover:border-emerald-600 lg:min-w-0 lg:flex-1",
            active && "border-emerald-600 ring-2 ring-emerald-600/30")}>
          <Logo team={team} size={32} />
          <span className="line-clamp-2 text-[11px] font-medium leading-tight">{team.name}</span>
          <span className="text-[10px] text-muted-foreground">{videoCount(team.id)} бичлэг</span>
        </Link>;
      })}
      {!teams.length && <p className="text-sm text-muted-foreground">Энэ улиралд баг бүртгэгдээгүй байна.</p>}
    </nav>

    <section aria-label={`${selectedTeam?.name ?? "Бүх"} тоглолтууд`} className="space-y-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        {selectedTeam ? <><Logo team={selectedTeam} size={28} />{selectedTeam.name}</> : "Бүх тоглолт"}
        <span className="text-sm font-normal text-muted-foreground">{withVideo.length} бичлэг · {teamGames.length} тоглолт</span>
      </h2>

      {!teamGames.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Тоглолт бүртгэгдээгүй байна.</p>}

      {withVideo.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {withVideo.map((game) => {
          const videoId = extractVideoId(game.video_url!);
          return <article key={game.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="p-2 text-sm"><GameCaption game={game} /></div>
            {videoId
              ? <iframe title={`Тоглолт ${gameNumber.get(game.id)}`} className="aspect-video w-full bg-black" loading="lazy"
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              : <p className="bg-black p-8 text-center text-sm text-white">YouTube холбоос буруу байна. <a href={game.video_url!} target="_blank" rel="noreferrer" className="underline">Шууд нээх</a></p>}
          </article>;
        })}
      </div>}

      {withoutVideo.length > 0 && <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><VideoOffIcon className="size-4" />Бичлэг ороогүй тоглолтууд</h3>
        <ol className="grid gap-2 md:grid-cols-2">
          {withoutVideo.map((game) => <li key={game.id} className="rounded-xl border bg-card p-3 opacity-70"><GameCaption game={game} /></li>)}
        </ol>
      </div>}
    </section>
  </div>;
}
