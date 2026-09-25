"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActivityIcon, ArrowDownUpIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildLoadMonitoring, shiftDay, type LoadBand } from "@/lib/club-load-monitoring";
import { calendarDay, CLUB_TIME_ZONE } from "@/lib/club-event-calendar";
import { compareMemberNames, type ReportAttendance, type ReportMember } from "@/lib/club-attendance-report";
import type { Club, ClubEvent } from "@/lib/types";
import "./club-attendance-report.css";

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
    .sort((a, b) => (descending ? b.hours - a.hours : a.hours - b.hours) || compareMemberNames(a.member, b.member));
  const unknown = report.players.filter(p => !p.band).length;
  const weekLink = (offset: number) => `/admin/club-load-monitoring?club=${encodeURIComponent(clubId)}&week=${shiftDay(from, offset)}`;
  const status = (p: typeof report.players[number]) => p.band ? BANDS[p.band].label : !report.weekComplete ? "Долоо хоног дуусаагүй" : !p.completed ? "Өгөгдөлгүй" : "Ирц дутуу";
  return <div className="cr"><div className="cr-page">
    <header className="cr-hero">
      <div className="cr-hero-top"><div><div className="cr-eyebrow"><ActivityIcon className="size-4" /> Training load</div>
        <h1>Ачааллын Monitoring</h1><p>{clubs.find(c => c.id === clubId)?.name ?? "Бүх клуб"} · Ирцэд тулгуурласан бэлтгэлийн цагийн хяналт</p>
      </div><Link className="cr-btn-ghost" href={`/admin/club-reports?club=${encodeURIComponent(clubId)}&from=${from}&to=${to}`}>Ирцийн тайлан ↗</Link></div>
      <div className="cr-hero-meta"><span className="cr-chip"><b>{from} — {to}</b><span>Даваа–Ням</span></span><span className="cr-chip"><b>{report.players.length}</b><span>тоглогч</span></span><span className="cr-chip">Заал + фитнесс</span><span className="cr-chip"><b>{unknown}</b><span>ангилал хүлээгдэж буй</span></span></div>
    </header>
    <section className="cr-card" aria-label="Ачааллын шүүлтүүр">
      <form action="/admin/club-load-monitoring" className="cr-load-filters">
        <label className="cr-field"><span>Клуб</span>{isAdmin ? <select name="club" defaultValue={clubId} className="cr-input"><option value="all">Бүх клуб</option>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <span className="cr-input">{clubs.find(c => c.id === clubId)?.name ?? "Клуб"}</span>}</label>
        <label className="cr-field"><span>Долоо хоног сонгох</span><input type="date" name="week" defaultValue={from} required className="cr-input num" /></label>
        <button type="submit" className="cr-btn">Тайлан харах</button>
        <div className="flex flex-wrap gap-2"><Link className="cr-btn cr-btn-2" href={weekLink(-7)}>← Өмнөх</Link><Link className="cr-btn cr-btn-2" href={weekLink(7)}>Дараах →</Link></div>
      </form>
    </section>
    <section className="cr-kpis" aria-label="Ачааллын ангилал">{Object.entries(BANDS).map(([key, value]) => <button key={key} type="button" aria-pressed={band === key} onClick={() => setBand(band === key ? "all" : key)} className={`cr-card cr-kpi cr-load-kpi ${band === key ? "selected" : ""}`}><span className="cr-kpi-l">{value.label}<span className={`cr-load-dot load-${key}`} /></span><span className="cr-kpi-v">{report.players.filter(p => p.band === key).length}<small>тоглогч</small></span><span className="cr-kpi-f">{value.range} · 7 хоногт</span></button>)}</section>
    {unknown > 0 && <p className="cr-load-notice">{unknown} тоглогчийн ангилал хүлээгдэж байна. Долоо хоног дуусаагүй, ирц дутуу эсвэл event байхгүй үед “бага” гэж дүгнэхгүй.</p>}
    <section className="cr-card">
      <div className="cr-card-h"><div><h2 className="cr-card-t">Тоглогчдын долоо хоногийн цаг <span className="cr-badge num">{players.length}</span></h2><p className="cr-card-s">Нэр дээр дарж дэлгэрэнгүйг харна · Цаг баганаар эрэмбэлнэ</p></div><div className="cr-tbl-tools"><label className="cr-search"><input aria-label="Тоглогч хайх" placeholder="Тоглогч хайх" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Ачааллын ангилал" value={band} onChange={e => setBand(e.target.value)} className="cr-input"><option value="all">Бүх ангилал</option>{Object.entries(BANDS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}<option value="unknown">Хүлээгдэж буй</option></select></div></div>
      <div className="cr-tbl-wrap"><table className="cr-tbl"><thead><tr><th className="p-3">Тоглогч</th><th className="p-3" aria-sort={descending ? "descending" : "ascending"}><button type="button" className="flex items-center gap-2" onClick={() => setDescending(v => !v)}>Цаг <ArrowDownUpIcon className="size-3" /></button></th><th className="p-3">Өмнөх 7 хоног</th><th className="p-3">Зөрүү</th><th className="p-3">Оролцсон</th><th className="p-3">Ирцийн бүрэн байдал</th><th className="p-3">Ангилал</th></tr></thead><tbody>
        {players.map(p => <tr key={p.member.id} className={p.band === "over" || p.band === "high" ? "flag" : ""}><td className="p-3"><button className="cr-load-name" aria-haspopup="dialog" onClick={() => setSelected(p.member.id)}>{p.member.first_name} {p.member.last_name}</button>{clubId === "all" && <p className="mt-1 text-xs text-muted-foreground">{clubs.find(c => c.id === p.member.club_id)?.name}</p>}</td><td className="min-w-36 p-3"><strong>{hours(p.hours)} цаг</strong><div className="relative mt-2 h-1.5 w-28 overflow-hidden rounded bg-muted"><div className={`h-full cr-load-fill load-${p.band ?? "unknown"}`} style={{ width: `${Math.min(100, p.hours / 24 * 100)}%` }} /></div></td><td className="p-3">{p.previousHours === null ? "—" : `${hours(p.previousHours)} цаг`}</td><td className="p-3">{p.delta === null ? "—" : `${p.delta > 0 ? "+" : ""}${hours(p.delta)} цаг`}</td><td className="p-3">{p.participated} бэлтгэл{p.late > 0 && <p className="mt-1 text-xs text-amber-600">{p.late} хоцролттой</p>}</td><td className="p-3">{p.coverage === null ? "—" : `${Math.round(p.coverage)}%`}{p.missing > 0 && <p className="text-xs text-amber-600">{p.missing} бөглөөгүй</p>}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs ${p.band ? BANDS[p.band].color : "bg-muted text-muted-foreground"}`}>{status(p)}</span>{p.hours > 24 && <p className="mt-2 text-xs text-rose-500">Бэлтгэлийн төлөвлөгөөг хянах</p>}</td></tr>)}
        {!players.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Тохирох тоглогч олдсонгүй.</td></tr>}
      </tbody></table></div>
    </section>
    <div className="cr-footer-note space-y-2">
      <p>Тооцоо: дууссан бэлтгэлд “Ирсэн / Хоцорсон” бол хуваарийн бүтэн цагийг нэмнэ. Бодит орсон/гарсан минут бүртгээгүй тул хоцролтыг цагаас хасаагүй. Тасалсан, чөлөөтэй, өвчтэй үед 0 цаг; бөглөөгүйг тодорхойгүй гэж үзнэ. Уулзалт, тоглолт болон системээс гадуурх бэлтгэл ороогүй.</p>
      <p>15 / 20 / 24 цаг нь танай багийн сонгосон хяналтын босго. “Босго давсан” нь бэртлийн онош эсвэл магадлал биш. Ачааллын эрчим, сэргэлт, биеийн байдлыг хамтад нь үнэлнэ. <a href="https://doi.org/10.1136/bjsports-2016-096581" target="_blank" rel="noreferrer" className="underline">IOC: ачааллын хяналтын зөвлөмж</a></p>
    </div>
    <Dialog open={!!person} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-3xl"><DialogHeader className="pr-8"><DialogTitle>{person?.member.first_name} {person?.member.last_name}</DialogTitle><DialogDescription>{from} — {to} · Бэлтгэлийн цагийн дэлгэрэнгүй</DialogDescription></DialogHeader>{person && <><div className="rounded-lg bg-emerald-500/10 p-4"><strong className="text-2xl">{hours(person.hours)} цаг</strong><span className="ml-3 text-sm">{status(person)}</span></div><div className="min-h-0 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Огноо / цаг", "Бэлтгэл", "Ирц", "Тооцсон цаг"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{person.sessions.map(s => <tr key={s.event.id} className="border-t"><td className="whitespace-nowrap p-2">{calendarDay(s.event.start_at)}<p className="text-xs text-muted-foreground">{time(s.event.start_at)}–{time(s.event.end_at)}</p></td><td className="p-2"><Link className="text-emerald-600 dark:text-emerald-300 hover:underline" href={`/admin/club-events/${s.event.id}/attendance`}>{s.event.name}</Link><p className="text-xs text-muted-foreground">{s.event.location ?? "—"}</p></td><td className="p-2">{LABELS[s.status]}{!s.completed && <p className="text-xs text-blue-500">Дуусаагүй</p>}</td><td className="p-2">{!s.completed || s.status === "unmarked" ? "—" : hours(s.hours)}</td></tr>)}</tbody></table>{!person.sessions.length && <p className="p-6 text-center text-muted-foreground">Бэлтгэлийн бүртгэл алга.</p>}</div></>}</DialogContent></Dialog>
  </div></div>;
}
