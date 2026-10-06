import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventEditor } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";
import { REPORT_CATEGORIES } from "@/lib/report-categories";
import { formatDuration, summarizeActivity, type ReportActivityAction } from "@/lib/report-activity";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: number;
  staff_id: string;
  game_id: string;
  report_slug: string;
  action: ReportActivityAction;
  target: string | null;
  duration_seconds: number | null;
  created_at: string;
  staff: { first_name: string; last_name: string; club: { name: string } | null } | null;
  game: { game_date: string | null; home: { name: string } | null; visitor: { name: string } | null } | null;
};

const MAX_ROWS = 10000;
const RECENT_ROWS = 300;
const PERIODS = [1, 7, 30, 90];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reportLabel = (slug: string) => (slug ? REPORT_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug : "Reports hub");
const when = (value: string) => `${calendarDay(value)} ${calendarTime(value)}`;
const ACTION_LABELS: Record<ReportActivityAction, string> = { view: "Нээсэн", click: "Дарсан", leave: "Хаасан" };

export default async function ReportActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const editor = await getEventEditor();
  if (editor?.role !== "superadmin") redirect("/admin");
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const days = PERIODS.includes(Number(one("days"))) ? Number(one("days")) : 30;
  const gameFilter = uuid.test(one("game")) ? one("game") : "";
  const staffFilter = uuid.test(one("staff")) ? one("staff") : "";
  // Dynamic Server Component: one request timestamp for the period window.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const rows: ActivityRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += 1000) {
    let query = supabaseAdmin().from("report_activity")
      .select("id,staff_id,game_id,report_slug,action,target,duration_seconds,created_at,staff:club_staff(first_name,last_name,club:clubs(name)),game:games(game_date,home:teams!games_home_team_id_fkey(name),visitor:teams!games_visitor_team_id_fkey(name))")
      .gte("created_at", since);
    if (gameFilter) query = query.eq("game_id", gameFilter);
    if (staffFilter) query = query.eq("staff_id", staffFilter);
    const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 999);
    if (error) return <p role="alert">Үзэлтийн бүртгэлийг ачаалж чадсангүй. (034_report_activity.sql migration ажиллуулсан эсэхээ шалгана уу.)</p>;
    rows.push(...((data ?? []) as unknown as ActivityRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }

  const staffName = new Map<string, string>();
  const staffClub = new Map<string, string>();
  const gameName = new Map<string, string>();
  for (const r of rows) {
    if (r.staff) {
      staffName.set(r.staff_id, `${r.staff.last_name} ${r.staff.first_name}`.trim());
      staffClub.set(r.staff_id, r.staff.club?.name ?? "—");
    }
    if (r.game) gameName.set(r.game_id, `${r.game.home?.name ?? "Home"} vs ${r.game.visitor?.name ?? "Visitor"}${r.game.game_date ? ` · ${calendarDay(r.game.game_date)}` : ""}`);
  }
  const summary = summarizeActivity(rows);
  const viewers = new Set(rows.map((r) => r.staff_id)).size;
  const views = rows.filter((r) => r.action === "view").length;
  const clicks = rows.filter((r) => r.action === "click").length;
  const seconds = rows.reduce((sum, r) => sum + (r.action === "leave" ? r.duration_seconds ?? 0 : 0), 0);
  const filterHref = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ days: String(days), game: gameFilter, staff: staffFilter, ...patch });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/admin/report-activity?${next}`;
  };

  return <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-semibold">Тайлангийн үзэлт</h1>
      <p className="mt-2 text-sm text-muted-foreground">Клубын ажилтнууд аль тоглолтын ямар тайланг хэр удаан үзэж, юун дээр дарсныг харуулна. Superadmin-ийн үзэлт бүртгэгдэхгүй.</p>
    </header>

    <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 text-sm">
      <label className="flex flex-col gap-1"><span className="text-muted-foreground">Хугацаа</span>
        <select name="days" defaultValue={String(days)} className="rounded-md border bg-background px-2 py-1.5">{PERIODS.map((d) => <option key={d} value={d}>Сүүлийн {d} хоног</option>)}</select>
      </label>
      <label className="flex flex-col gap-1"><span className="text-muted-foreground">Тоглолт</span>
        <select name="game" defaultValue={gameFilter} className="max-w-72 rounded-md border bg-background px-2 py-1.5"><option value="">Бүгд</option>{[...gameName].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1"><span className="text-muted-foreground">Хүн</span>
        <select name="staff" defaultValue={staffFilter} className="max-w-60 rounded-md border bg-background px-2 py-1.5"><option value="">Бүгд</option>{[...staffName].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </label>
      <button className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600">Шүүх</button>
      {(gameFilter || staffFilter) && <Link href={filterHref({ game: "", staff: "" })} className="px-2 py-2 text-muted-foreground underline">Цэвэрлэх</Link>}
    </form>

    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Үзсэн хүн", viewers], ["Нээлт", views], ["Нийт үзсэн хугацаа", formatDuration(seconds)], ["Click", clicks]].map(([label, value]) =>
        <div key={label} className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div></div>)}
    </section>

    <section aria-label="Хүн, тайлангаар" className="overflow-hidden rounded-xl border bg-card">
      <h2 className="border-b p-4 font-semibold">Хүн · тоглолт · тайлангаар</h2>
      {!summary.length ? <p className="p-8 text-center text-sm text-muted-foreground">Энэ хугацаанд үзэлт бүртгэгдээгүй байна.</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground"><tr><th className="p-3">Хүн</th><th className="p-3">Клуб</th><th className="p-3">Тоглолт</th><th className="p-3">Тайлан</th><th className="p-3 text-right">Нээсэн</th><th className="p-3 text-right">Хугацаа</th><th className="p-3 text-right">Click</th><th className="p-3">Сүүлд · УБ</th></tr></thead>
          <tbody>{summary.map((s) => <tr key={`${s.staffId}|${s.gameId}|${s.slug}`} className="border-b last:border-0 hover:bg-muted/30">
            <td className="p-3 font-medium"><Link href={filterHref({ staff: s.staffId })} className="hover:underline">{staffName.get(s.staffId) ?? "—"}</Link></td>
            <td className="p-3">{staffClub.get(s.staffId) ?? "—"}</td>
            <td className="p-3"><Link href={filterHref({ game: s.gameId })} className="hover:underline">{gameName.get(s.gameId) ?? "—"}</Link></td>
            <td className="p-3">{reportLabel(s.slug)}</td>
            <td className="p-3 text-right tabular-nums">{s.views}</td>
            <td className="p-3 text-right tabular-nums">{formatDuration(s.seconds)}</td>
            <td className="p-3 text-right tabular-nums">{s.clicks}</td>
            <td className="whitespace-nowrap p-3">{when(s.lastAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    <section aria-label="Бүх лог" className="overflow-hidden rounded-xl border bg-card">
      <h2 className="border-b p-4 font-semibold">Бүх лог <span className="text-sm font-normal text-muted-foreground">(сүүлийн {Math.min(RECENT_ROWS, rows.length)})</span></h2>
      {!!rows.length && <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b bg-card text-muted-foreground"><tr><th className="p-3">Цаг · УБ</th><th className="p-3">Хүн</th><th className="p-3">Тоглолт</th><th className="p-3">Тайлан</th><th className="p-3">Үйлдэл</th><th className="p-3">Дэлгэрэнгүй</th></tr></thead>
          <tbody>{rows.slice(0, RECENT_ROWS).map((r) => <tr key={r.id} className="border-b last:border-0">
            <td className="whitespace-nowrap p-3 tabular-nums">{when(r.created_at)}</td>
            <td className="p-3">{staffName.get(r.staff_id) ?? "—"}</td>
            <td className="p-3">{gameName.get(r.game_id) ?? "—"}</td>
            <td className="p-3">{reportLabel(r.report_slug)}</td>
            <td className="p-3">{ACTION_LABELS[r.action]}</td>
            <td className="p-3 text-muted-foreground">{r.action === "click" ? r.target : r.action === "leave" ? `${formatDuration(r.duration_seconds ?? 0)} үзсэн` : ""}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
    {rows.length >= MAX_ROWS && <p className="text-xs text-muted-foreground">Эхний {MAX_ROWS} мөрийг харууллаа — хугацаа эсвэл шүүлтүүрээ нарийсгана уу.</p>}
  </div>;
}
