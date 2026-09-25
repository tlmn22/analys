import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheckIcon } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import { summarizeDecisions } from "@/lib/decision-quality";
import { getReportHeaderInfo } from "../shared-data";
import { ReportHeader } from "../report-header";

export const dynamic = "force-dynamic";

export default async function DecisionMakingPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const info = await getReportHeaderInfo(gameId);
  if (!info) notFound();
  const db = supabaseAdmin();
  const events: Parameters<typeof summarizeDecisions>[0] = [];
  let failed = false;
  // Fetch every event, including games beyond the API's default row limit.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("game_events")
      .select("id, event_type, player_id, team_id, decision_quality")
      .eq("game_id", gameId).order("id").range(offset, offset + 999);
    if (error) { failed = true; break; }
    events.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const rows = summarizeDecisions(events);
  const ids = [...new Set(rows.map(row => row.playerId))];
  const { data: players, error: playersError } = ids.length
    ? await db.from("players").select("id, first_name, last_name").in("id", ids)
    : { data: [], error: null };
  const names = new Map((players ?? []).map(player => [player.id, `${player.first_name} ${player.last_name}`]));
  const teams = [{ id: info.game.home_team_id, name: info.homeTeamName }, { id: info.game.visitor_team_id, name: info.visitorTeamName }];
  return <main className="min-h-screen bg-background p-6 text-foreground">
    <div className="mx-auto max-w-[1600px] space-y-6">
      <Link href={`/admin/tag/${gameId}`} className="text-sm text-blue-500 hover:underline">← Tag руу буцах</Link>
      <ReportHeader gameId={gameId} icon={<ClipboardCheckIcon className="size-7" />} title="Довтолгооны шийдвэр" activeSlug="decision-making" info={info} />
      <p className="text-sm text-muted-foreground">Зөв шийдвэрийн хувь = Зөв / (Зөв + Буруу). Үнэлээгүй үйлдлийг хувьд оруулахгүй. Энэ нь тэмдэглэсэн үйлдлийн үнэлгээ бөгөөд нийт довтолгооны тоо биш.</p>
      {failed || playersError ? <p role="alert" className="rounded border border-amber-500/40 p-4 text-amber-500">Шийдвэрийн үнэлгээг ачаалж чадсангүй. Дахин ачаална уу. Шинээр суулгаж байгаа бол өгөгдлийн сангийн шинэчлэл хийгдсэн эсэхийг шалгана уу.</p> :
        teams.map(team => {
          const teamRows = rows.filter(row => row.teamId === team.id).sort((a, b) => (b.percentage ?? -1) - (a.percentage ?? -1) || b.good - a.good);
          const good = teamRows.reduce((sum, row) => sum + row.good, 0);
          const bad = teamRows.reduce((sum, row) => sum + row.bad, 0);
          const ungraded = teamRows.reduce((sum, row) => sum + row.ungraded, 0);
          return <section key={team.id} className="overflow-hidden rounded-xl border border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4">
              <h2 className="text-lg font-semibold">{team.name}</h2>
              <div className="flex gap-4 text-sm"><span className="text-emerald-500">Зөв {good}</span><span className="text-red-400">Буруу {bad}</span><strong>{good + bad ? `${(good / (good + bad) * 100).toFixed(1)}%` : "Үнэлгээ алга"}</strong></div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr>{["Тоглогч", "Зөв", "Буруу", "Үнэлсэн", "Үнэлээгүй", "Зөв шийдвэр %"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
              <tbody>{teamRows.map(row => <tr key={row.playerId} className="border-b border-border/50 hover:bg-muted/30">
                <th scope="row" className="p-3 text-left font-medium">{names.get(row.playerId) ?? row.playerId}</th>
                <td className="p-3 text-emerald-500">{row.good}</td><td className="p-3 text-red-400">{row.bad}</td>
                <td className="p-3">{row.good + row.bad}</td><td className="p-3 text-muted-foreground">{row.ungraded}</td>
                <td className="p-3 font-semibold">{row.percentage == null ? "—" : `${row.percentage.toFixed(1)}%`}</td>
              </tr>)}</tbody>
              <tfoot className="bg-muted/20 font-semibold"><tr><th scope="row" className="p-3 text-left">Нийт</th><td className="p-3">{good}</td><td className="p-3">{bad}</td><td className="p-3">{good + bad}</td><td className="p-3">{ungraded}</td><td className="p-3">{good + bad ? `${(good / (good + bad) * 100).toFixed(1)}%` : "—"}</td></tr></tfoot>
            </table></div>
            {!teamRows.length && <p className="p-6 text-sm text-muted-foreground">Довтолгооны event хараахан бүртгээгүй байна.</p>}
          </section>;
        })}
    </div>
  </main>;
}
