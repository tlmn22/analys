import Link from "next/link";
import { redirect } from "next/navigation";
import { getPackageRecipient } from "@/lib/package-recipient-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ScheduleList, type PlayerEvent } from "@/components/player/schedule-list";
import { getPlayerAttendance } from "@/lib/player-attendance";
import { AttendanceSummary } from "@/components/player/attendance-summary";

export default async function PlayerHome() {
  const member = await getPackageRecipient();
  if (!member) redirect("/admin/login");
  // Dynamic Server Component: capture one request timestamp for queries and display.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const db = supabaseAdmin();
  const [events, packages, attendance] = await Promise.all([
    db.from("club_events").select("id,name,event_type,start_at,end_at,location,description").eq("club_id", member.club_id).gt("end_at", new Date(now).toISOString()).order("start_at").order("id").limit(3),
    db.from("event_package_assignments").select("id,package:event_packages(id,name,description)", { count: "exact" }).eq("member_id", member.id).order("created_at", { ascending: false }).order("id").limit(3),
    getPlayerAttendance(member, now),
  ]);
  const rows = (packages.data ?? []) as unknown as { id: string; package: { id: string; name: string; description: string } | null }[];
  return <main className="space-y-7 p-4 sm:p-6">
    <AttendanceSummary summary={attendance} />
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Ойрын хуваарь</h2><Link href="/player/schedule" className="text-sm text-emerald-600">Бүгдийг харах →</Link></div>{events.error ? <p role="alert">Хуваарийг ачаалж чадсангүй.</p> : <ScheduleList events={(events.data ?? []) as PlayerEvent[]} now={now} />}</section>
    <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Сүүлд хуваарилсан багцууд</h2><Link href="/my-packages" className="text-sm text-emerald-600">Бүгдийг харах →</Link></div>{packages.error ? <p role="alert">Багцуудыг ачаалж чадсангүй.</p> : rows.length ? <div className="grid gap-3 sm:grid-cols-3">{rows.map(row => row.package && <Link key={row.id} href={`/my-packages/${row.package.id}`} className="rounded-2xl border bg-card p-5 hover:border-emerald-600"><span className="text-xs text-emerald-600">SCOUTING · БИЧЛЭГ</span><h3 className="mt-2 break-words font-semibold">{row.package.name}</h3><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{row.package.description || "Бичлэгүүдээ нээж үзээрэй."}</p><span className="mt-4 block text-sm text-emerald-600">Үзэх →</span></Link>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Танд багц хуваарилагдахад энд харагдана.</p>}</section>
  </main>;
}
