"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActivityIcon, ArrowDownUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildLoadMonitoring, shiftDay, type LoadBand } from "@/lib/club-load-monitoring";
import { calendarDay, CLUB_TIME_ZONE } from "@/lib/club-event-calendar";
import type { ReportAttendance, ReportMember } from "@/lib/club-attendance-report";
import type { Club, ClubEvent } from "@/lib/types";

const BANDS: Record<LoadBand, { label: string; range: string; color: string }> = {
  low: { label: "Бага", range: "< 15 цаг", color: "bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  normal: { label: "Хэвийн хүрээ", range: "15–20 цаг", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  high: { label: "Их", range: "> 20–24 цаг", color: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  over: { label: "Босго давсан", range: "> 24 цаг", color: "bg-rose-500/10 text-rose-600 dark:text-rose-300" },
};
const LABELS = { present: "Ирсэн", late: "Хоцорсон", absent: "Тасалсан", excused: "Чөлөөтэй", sick: "Өвчтэй", unmarked: "Бөглөөгүй" };
const time = (date: string) => new Date(date).toLocaleTimeString("en-GB", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const hours = (value: number) => value.toLocaleString("mn-MN", { maximumFractionDigits: 1 });

export function ClubLoadMonitoring({ clubs, clubId, isAdmin, events, members, attendance, from, to, now }: {
  clubs: Pick<Club, "id" | "name">[]; clubId: string; isAdmin: boolean; events: ClubEvent[];
  members: ReportMember[]; attendance: ReportAttendance[]; from: string; to: string; now: number;
}) {
  const report = useMemo(() => buildLoadMonitoring(events, members, attendance, from, now), [events, members, attendance, from, now]);
  const [search, setSearch] = useState("");
  const [band, setBand] = useState("all");
  const [descending, setDescending] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const person = report.players.find(p => p.member.id === selected);
  const players = report.players.filter(p => `${p.member.first_name} ${p.member.last_name}`.toLowerCase().includes(search.toLowerCase()) && (band === "all" || (p.band ?? "unknown") === band))
    .sort((a, b) => (descending ? b.hours - a.hours : a.hours - b.hours) || a.member.first_name.localeCompare(b.member.first_name, "mn"));
  const unknown = report.players.filter(p => !p.band).length;
  const weekLink = (offset: number) => `/admin/club-load-monitoring?club=${encodeURIComponent(clubId)}&week=${shiftDay(from, offset)}`;
  const status = (p: typeof report.players[number]) => p.band ? BANDS[p.band].label : !report.weekComplete ? "Долоо хоног дуусаагүй" : !p.completed ? "Өгөгдөлгүй" : "Ирц дутуу";
  return <div className="mx-auto max-w-[1600px] space-y-6 pb-6">
    <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-7 text-white">
      <p className="mb-3 flex items-center gap-2 text-xs tracking-widest text-indigo-300"><ActivityIcon className="size-4" /> TRAINING LOAD</p>
      <h1 className="text-3xl font-semibold">Ачааллын Monitoring</h1>
      <p className="mt-2 text-sm text-slate-300">{clubs.find(c => c.id === clubId)?.name ?? "Бүх клуб"} · {from} — {to} · Даваа–Ням</p>
      <p className="mt-4 text-xs text-slate-300">Ирцэд тулгуурласан бэлтгэлийн цагийн ойролцоо дүн · Заал + фитнесс</p>
    </header>
    <form action="/admin/club-load-monitoring" className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      {isAdmin && <label className="space-y-1 text-xs">Клуб<select name="club" defaultValue={clubId} className="block h-9 rounded-md border bg-background px-3"><option value="all">Бүх клуб</option>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="space-y-1 text-xs">Долоо хоног сонгох<Input type="date" name="week" defaultValue={from} required className="h-9" /></label>
      <Button type="submit">Харах</Button>
      <div className="ml-auto flex gap-3 text-sm"><Link className="rounded border px-3 py-2 hover:bg-muted" href={weekLink(-7)}>← Өмнөх</Link><Link className="rounded border px-3 py-2 hover:bg-muted" href={weekLink(7)}>Дараах →</Link></div>
    </form>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(BANDS).map(([key, value]) => <button key={key} type="button" aria-pressed={band === key} onClick={() => setBand(band === key ? "all" : key)} className={`rounded-xl border p-5 text-left ${value.color} ${band === key ? "ring-2 ring-current" : ""}`}><p className="text-sm font-medium">{value.label} · {value.range}</p><p className="mt-2 text-3xl font-semibold">{report.players.filter(p => p.band === key).length}<span className="ml-2 text-xs font-normal">тоглогч</span></p></button>)}</div>
    {unknown > 0 && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{unknown} тоглогчийн ангилал хүлээгдэж байна. Долоо хоног дуусаагүй, ирц дутуу эсвэл event байхгүй үед “бага” гэж дүгнэхгүй.</p>}
    <section className="overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center gap-3 border-b p-4"><div className="mr-auto"><h2 className="font-semibold">Тоглогчдын долоо хоногийн цаг</h2><p className="mt-1 text-xs text-muted-foreground">Нэр дээр дарж тооцоонд орсон бэлтгэлүүдийг харна.</p></div><Input aria-label="Тоглогч хайх" placeholder="Тоглогч хайх" value={search} onChange={e => setSearch(e.target.value)} className="w-52" /><select aria-label="Ачааллын ангилал" value={band} onChange={e => setBand(e.target.value)} className="rounded border bg-background p-2 text-sm"><option value="all">Бүх ангилал</option>{Object.entries(BANDS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}<option value="unknown">Хүлээгдэж буй</option></select></div>
      <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="p-3">Тоглогч</th><th className="p-3" aria-sort={descending ? "descending" : "ascending"}><button className="flex items-center gap-2" onClick={() => setDescending(v => !v)}>Цаг <ArrowDownUpIcon className="size-3" /></button></th><th className="p-3">Өмнөх 7 хоног</th><th className="p-3">Зөрүү</th><th className="p-3">Оролцсон</th><th className="p-3">Ирцийн бүрэн байдал</th><th className="p-3">Ангилал</th></tr></thead><tbody>
        {players.map(p => <tr key={p.member.id} className="border-t hover:bg-muted/30"><td className="p-3"><button className="text-left font-medium text-indigo-600 hover:underline dark:text-indigo-300" aria-haspopup="dialog" onClick={() => setSelected(p.member.id)}>{p.member.first_name} {p.member.last_name}</button>{clubId === "all" && <p className="mt-1 text-xs text-muted-foreground">{clubs.find(c => c.id === p.member.club_id)?.name}</p>}</td><td className="min-w-36 p-3"><strong>{hours(p.hours)} цаг</strong><div className="relative mt-2 h-1.5 w-28 overflow-hidden rounded bg-muted"><div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, p.hours / 24 * 100)}%` }} /></div></td><td className="p-3">{p.previousHours === null ? "—" : `${hours(p.previousHours)} цаг`}</td><td className="p-3">{p.delta === null ? "—" : `${p.delta > 0 ? "+" : ""}${hours(p.delta)} цаг`}</td><td className="p-3">{p.participated} бэлтгэл{p.late > 0 && <p className="mt-1 text-xs text-amber-600">{p.late} хоцролттой</p>}</td><td className="p-3">{p.coverage === null ? "—" : `${Math.round(p.coverage)}%`}{p.missing > 0 && <p className="text-xs text-amber-600">{p.missing} бөглөөгүй</p>}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs ${p.band ? BANDS[p.band].color : "bg-muted text-muted-foreground"}`}>{status(p)}</span>{p.hours > 24 && <p className="mt-2 text-xs text-rose-500">Бэлтгэлийн төлөвлөгөөг хянах</p>}</td></tr>)}
        {!players.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Тохирох тоглогч олдсонгүй.</td></tr>}
      </tbody></table></div>
    </section>
    <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
      <p>Тооцоо: дууссан бэлтгэлд “Ирсэн / Хоцорсон” бол хуваарийн бүтэн цагийг нэмнэ. Бодит орсон/гарсан минут бүртгээгүй тул хоцролтыг цагаас хасаагүй. Тасалсан, чөлөөтэй, өвчтэй үед 0 цаг; бөглөөгүйг тодорхойгүй гэж үзнэ. Уулзалт, тоглолт болон системээс гадуурх бэлтгэл ороогүй.</p>
      <p>15 / 20 / 24 цаг нь танай багийн сонгосон хяналтын босго. “Босго давсан” нь бэртлийн онош эсвэл магадлал биш. Ачааллын эрчим, сэргэлт, биеийн байдлыг хамтад нь үнэлнэ. <a href="https://doi.org/10.1136/bjsports-2016-096581" target="_blank" rel="noreferrer" className="underline">IOC: ачааллын хяналтын зөвлөмж</a></p>
    </div>
    <Dialog open={!!person} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-3xl"><DialogHeader className="pr-8"><DialogTitle>{person?.member.first_name} {person?.member.last_name}</DialogTitle><DialogDescription>{from} — {to} · Бэлтгэлийн цагийн дэлгэрэнгүй</DialogDescription></DialogHeader>{person && <><div className="rounded-lg bg-indigo-500/10 p-4"><strong className="text-2xl">{hours(person.hours)} цаг</strong><span className="ml-3 text-sm">{status(person)}</span></div><div className="min-h-0 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Огноо / цаг", "Бэлтгэл", "Ирц", "Тооцсон цаг"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{person.sessions.map(s => <tr key={s.event.id} className="border-t"><td className="whitespace-nowrap p-2">{calendarDay(s.event.start_at)}<p className="text-xs text-muted-foreground">{time(s.event.start_at)}–{time(s.event.end_at)}</p></td><td className="p-2"><Link className="text-indigo-500 hover:underline" href={`/admin/club-events/${s.event.id}/attendance`}>{s.event.name}</Link><p className="text-xs text-muted-foreground">{s.event.location ?? "—"}</p></td><td className="p-2">{LABELS[s.status]}{!s.completed && <p className="text-xs text-blue-500">Дуусаагүй</p>}</td><td className="p-2">{!s.completed || s.status === "unmarked" ? "—" : hours(s.hours)}</td></tr>)}</tbody></table>{!person.sessions.length && <p className="p-6 text-center text-muted-foreground">Бэлтгэлийн бүртгэл алга.</p>}</div></>}</DialogContent></Dialog>
  </div>;
}
