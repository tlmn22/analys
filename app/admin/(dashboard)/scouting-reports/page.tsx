import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventEditor } from "@/lib/club-event-access";
import { SCOUTING_SEASON_IDS } from "@/lib/scouting-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";

type ScoutingGame = {
  id: string; season_id: string; game_date: string | null;
  home: { name: string } | null; visitor: { name: string } | null;
  game_events: { count: number }[];
};

export default async function ScoutingReportsPage() {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const db = supabaseAdmin();
  const seasons = await db.from("seasons").select("id,name").in("id", SCOUTING_SEASON_IDS);
  if (seasons.error) return <p role="alert">Улирлуудыг ачаалж чадсангүй.</p>;
  const games: ScoutingGame[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("games")
      .select("id,season_id,game_date,home:teams!games_home_team_id_fkey(name),visitor:teams!games_visitor_team_id_fkey(name),game_events(count)")
      .in("season_id", SCOUTING_SEASON_IDS)
      .order("game_date", { ascending: false, nullsFirst: false }).order("id")
      .range(offset, offset + 499);
    if (error) return <p role="alert">Тоглолтуудыг ачаалж чадсангүй.</p>;
    games.push(...(data ?? []) as unknown as ScoutingGame[]);
    if ((data?.length ?? 0) < 500) break;
  }
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-semibold">Scouting Reports</h1>
      <p className="mt-2 text-sm text-muted-foreground">{seasons.data?.length ?? 0} улирал · {games.length} тоглолт · Тоглолтоо сонгоод тайлан, event бичлэгийг үзээрэй.</p>
    </header>
    <section aria-label="Тоглолтын тайлангууд" className="overflow-hidden rounded-xl border bg-card">
        {!games.length ? <p className="p-8 text-center text-sm text-muted-foreground">Тоглолт бүртгэгдээгүй байна.</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground"><tr><th className="p-4">Тоглолт</th><th className="p-4">Улирал</th><th className="p-4">Огноо · УБ</th><th className="p-4">Event</th><th className="p-4"><span className="sr-only">Тайлан</span></th></tr></thead>
            <tbody>{games.map(game => <tr key={game.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-4 font-medium">{game.home?.name ?? "Home"} <span className="text-muted-foreground">vs</span> {game.visitor?.name ?? "Visitor"}</td>
              <td className="p-4">{seasons.data?.find(season => season.id === game.season_id)?.name ?? "—"}</td>
              <td className="whitespace-nowrap p-4">{game.game_date ? `${calendarDay(game.game_date)} ${calendarTime(game.game_date)}` : "Огноо товлоогүй"}</td>
              <td className="p-4">{game.game_events[0]?.count ?? 0}</td>
              <td className="whitespace-nowrap p-4"><Link href={`/admin/tag/${game.id}/reports`} className="inline-flex rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white hover:bg-emerald-600">Тайлан үзэх →</Link></td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
  </div>;
}
