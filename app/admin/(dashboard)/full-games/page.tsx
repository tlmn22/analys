import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayIcon, VideoOffIcon } from "lucide-react";
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
  const teamGames = selectedTeam ? games.filter((g) => g.home_team_id === selectedTeam.id || g.visitor_team_id === selectedTeam.id) : [];
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

  const playing = teamGames.find((g) => g.id === one("v") && g.video_url);
  const playingId = playing?.video_url ? extractVideoId(playing.video_url) : null;
  const href = (team: string, video?: string) => `/admin/full-games?team=${team}${video ? `&v=${video}#player` : ""}`;

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold">Full Game</h1>
      <p className="mt-2 text-sm text-muted-foreground">{season.data?.name ?? "Улирал"} · Багаа сонгоод тоглолтын бүтэн бичлэгийг үзээрэй.</p>
    </header>

    <nav aria-label="Багууд" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {teams.map((team) => {
        const active = team.id === selectedTeam?.id;
        return <Link key={team.id} href={href(team.id)} aria-current={active ? "page" : undefined}
          className={cn("flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:border-emerald-600",
            active && "border-emerald-600 ring-2 ring-emerald-600/30")}>
          <Logo team={team} size={56} />
          <span className="text-sm font-medium leading-tight">{team.name}</span>
          <span className="text-xs text-muted-foreground">{videoCount(team.id)} бичлэг</span>
        </Link>;
      })}
      {!teams.length && <p className="col-span-full text-sm text-muted-foreground">Энэ улиралд баг бүртгэгдээгүй байна.</p>}
    </nav>

    {selectedTeam && <section aria-label={`${selectedTeam.name} тоглолтууд`} className="space-y-4">
      <h2 className="flex items-center gap-3 text-lg font-semibold"><Logo team={selectedTeam} size={32} />{selectedTeam.name} — тоглолтууд</h2>

      {playing && <div id="player" className="scroll-mt-20 overflow-hidden rounded-xl border bg-black">
        {playingId
          ? <iframe key={playing.id} title="Тоглолтын бичлэг" className="aspect-video w-full" src={`https://www.youtube.com/embed/${playingId}?rel=0&playsinline=1&autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          : <p className="p-8 text-center text-sm text-white">YouTube холбоос буруу байна. <a href={playing.video_url!} target="_blank" rel="noreferrer" className="underline">Шууд нээх</a></p>}
      </div>}

      {!teamGames.length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Тоглолт бүртгэгдээгүй байна.</p>
        : <ol className="grid gap-2 md:grid-cols-2">
          {teamGames.map((game, index) => {
            const home = game.home_team_id === selectedTeam.id;
            const opponent = teamById.get(home ? game.visitor_team_id : game.home_team_id);
            const score = scores.get(game.id);
            const ours = score?.get(selectedTeam.id) ?? 0;
            const theirs = score?.get(opponent?.id ?? "") ?? 0;
            const day = game.game_date ? calendarDay(game.game_date) : null;
            const content = <>
              <span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">{index + 1}</span>
              <Logo team={opponent} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{home ? "vs" : "@"} {opponent?.name ?? "Өрсөлдөгч"}</span>
                <span className="block text-xs text-muted-foreground">
                  {day ? `${day} · ${WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]} · ${calendarTime(game.game_date!)}` : "Огноо товлоогүй"} · {home ? "Home" : "Away"}
                </span>
              </span>
              {score && <span className={cn("font-mono text-sm font-semibold tabular-nums", ours > theirs ? "text-emerald-600" : ours < theirs ? "text-red-600" : "")}>{ours}–{theirs}</span>}
              {game.video_url
                ? <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"><PlayIcon className="size-3.5" />Үзэх</span>
                : <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><VideoOffIcon className="size-3.5" />Бичлэггүй</span>}
            </>;
            const base = "flex items-center gap-3 rounded-xl border bg-card p-3";
            return <li key={game.id}>
              {game.video_url
                ? <Link href={href(selectedTeam.id, game.id)} aria-current={playing?.id === game.id ? "true" : undefined}
                    className={cn(base, "hover:border-emerald-600", playing?.id === game.id && "border-emerald-600 bg-emerald-600/5")}>{content}</Link>
                : <div className={cn(base, "opacity-70")}>{content}</div>}
            </li>;
          })}
        </ol>}
    </section>}
  </div>;
}
