import type { getPlayerAttendance } from "@/lib/player-attendance";

const statuses = [
  { key: "present", label: "Ирсэн", color: "bg-emerald-400" },
  { key: "late", label: "Хоцорсон", color: "bg-amber-400" },
  { key: "absent", label: "Тасалсан", color: "bg-rose-400" },
  { key: "excused", label: "Чөлөөтэй", color: "bg-blue-400" },
  { key: "sick", label: "Өвчтэй", color: "bg-purple-400" },
] as const;

export function AttendanceSummary({ summary }: { summary: Awaited<ReturnType<typeof getPlayerAttendance>> }) {
  return <section className="rounded-2xl bg-emerald-950 p-5 text-white sm:p-6" aria-label="Өөрийн нийт ирц">
    <h1 className="text-xl font-semibold">Миний ирц</h1><p className="mt-1 text-xs text-emerald-100/80">Өөрийн клубын дууссан event-үүд · Бүх хугацаа</p>
    {summary.error || !summary.counts ? <p role="alert" className="mt-5 text-sm">{summary.error}</p> : <>
      <div className="my-5 flex flex-wrap items-end gap-x-8 gap-y-3"><div><p className="text-xs text-emerald-100">Ирцийн хувь</p><p className="mt-1 text-4xl font-bold tabular-nums">{summary.rate === null ? "—" : `${Math.round(summary.rate!)}%`}</p></div><div className="text-sm text-emerald-100"><p><b className="text-white">{summary.counts.present + summary.counts.late}</b> / {summary.marked} бүртгэлд оролцсон</p><p className="mt-1">Нийт {summary.total} event</p></div></div>
      <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">{statuses.map(status => <span key={status.key} className={status.color} style={{ width: `${summary.marked ? summary.counts![status.key] / summary.marked * 100 : 0}%` }} />)}</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{statuses.map(status => <div key={status.key} className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="flex items-center gap-1.5 text-[11px] text-emerald-50"><i className={`size-1.5 shrink-0 rounded-full ${status.color}`} />{status.label}</span><b className="mt-2 block text-xl tabular-nums">{summary.counts![status.key]}</b></div>)}</div>
      <p className="mt-4 text-xs leading-relaxed text-emerald-100/80">Ирсэн + хоцорсон нь оролцсонд тооцогдоно. Тасалсан, чөлөөтэй, өвчтэй нь ирцийн хувийг бууруулна.</p>
      {summary.marked === 0 && <p className="mt-2 text-sm text-emerald-100">Одоогоор тооцох ирцийн бүртгэл алга.</p>}
    </>}
  </section>;
}
