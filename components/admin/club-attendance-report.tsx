"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ActivityIcon, ArrowUpRightIcon, CalendarDaysIcon, DownloadIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { calendarDay, CLUB_TIME_ZONE } from "@/lib/club-event-calendar";
import { buildAttendanceReport, compareMembers, memberAttendanceDetails, type MemberSortKey, type AttendanceCounts, type ReportAttendance, type ReportMember } from "@/lib/club-attendance-report";
import type { Club, ClubEvent, ClubEventType } from "@/lib/types";
import "./club-attendance-report.css";

const TYPES: Record<ClubEventType, string> = { gym_prep: "Заалны бэлтгэл", fitness_prep: "Фитнесс бэлтгэл", team_meeting: "Багийн уулзалт", other: "Бусад" };
const ROLES: Record<ReportMember["role"], string> = { owner: "Эзэмшигч", manager: "Менежер", head_coach: "Ахлах дасгалжуулагч", assistant_coach: "Туслах дасгалжуулагч", player: "Тоглогч" };
const STATUS = [
  { key: "present", label: "Ирсэн", color: "#10b981", bg: "bg-emerald-500" },
  { key: "late", label: "Хоцорсон", color: "#f59e0b", bg: "bg-amber-500" },
  { key: "absent", label: "Тасалсан", color: "#f43f5e", bg: "bg-rose-500" },
  { key: "excused", label: "Чөлөөтэй", color: "#6366f1", bg: "bg-indigo-500" },
  { key: "sick", label: "Өвчтэй", color: "#06b6d4", bg: "bg-cyan-500" },
  { key: "unmarked", label: "Бөглөөгүй", color: "#cbd5e1", bg: "bg-slate-300" },
] as const;
const pct = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;


function StatusBar({ counts }: { counts: AttendanceCounts }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return <div className="cr-stack" role="img" aria-label={STATUS.map(s => `${s.label}: ${counts[s.key]}`).join(", ")}>
    {STATUS.map(s => <i key={s.key} className={`s-${s.key}`} style={{ width: `${total ? counts[s.key] / total * 100 : 0}%` }} title={`${s.label}: ${counts[s.key]}`} />)}
  </div>;
}

export function ClubAttendanceReport({ clubs, clubId, isAdmin, events, members, attendance, from, to, now, initialEventType = "all", initialScope = "players" }: {
  clubs: Pick<Club, "id" | "name">[]; clubId: string; isAdmin: boolean;
  events: ClubEvent[]; members: ReportMember[]; attendance: ReportAttendance[];
  from: string; to: string; now: number; initialEventType?: string; initialScope?: string;
}) {
  const [eventType, setEventType] = useState(initialEventType);
  const [scope, setScope] = useState(initialScope);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MemberSortKey>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(0);
  const [eventLimit, setEventLimit] = useState(10);
  const filteredEvents = useMemo(() => events.filter((e) => eventType === "all" || (eventType === "training" ? ["gym_prep", "fitness_prep"].includes(e.event_type) : e.event_type === eventType)), [events, eventType]);
  const selectedMembers = useMemo(() => members.filter((m) => scope === "all" || (scope === "players" ? m.role === "player" : m.role !== "player")), [members, scope]);
  const report = useMemo(() => buildAttendanceReport(filteredEvents, selectedMembers, attendance, now), [filteredEvents, selectedMembers, attendance, now]);
  const clubName = clubId === "all" ? "Бүх клуб" : clubs.find((c) => c.id === clubId)?.name ?? "Клуб";
  const people = report.people.filter(p => !attentionOnly || p.counts.absent > 0 || (p.rate !== null && p.rate < 90)).filter((p) => `${p.member.first_name} ${p.member.last_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => compareMembers(a, b, sort, direction));
  function changeSort(key: MemberSortKey) {
    setDirection(key === sort ? (direction === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc");
    setSort(key); setTablePage(0);
  }
  const columns: { key: MemberSortKey; label: string }[] = [{ key: "name", label: "ГИШҮҮН" }, { key: "events", label: "EVENT" }, ...STATUS.map(s => ({ key: s.key, label: s.label })), { key: "rate", label: "ИРЦ %" }];
  const selectedPerson = report.people.find(p => p.member.id === selectedMemberId);
  const details = selectedPerson ? memberAttendanceDetails(filteredEvents, selectedPerson.member, attendance, now) : [];

  const page = Math.min(tablePage, Math.max(0, Math.ceil(people.length / 15) - 1));
  const completedEvents = report.eventRows.filter((e) => e.completed);
  const trend = completedEvents.slice(-14);
  const required = report.total.present + report.total.late + report.total.absent + report.total.excused + report.total.sick;
  const participating = report.total.present + report.total.late;
  const today = calendarDay(new Date(now));
  const shift = (day: string, amount: number) => { const date = new Date(`${day}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); };
  const monthStart = `${today.slice(0, 7)}-01`;
  const previousEnd = shift(monthStart, -1);
  const quarterMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
  const presets = [
    { label: "Сүүлийн 7 хоног", start: shift(today, -6), end: today },
    { label: "Энэ сар", start: monthStart, end: today },
    { label: "Өмнөх сар", start: `${previousEnd.slice(0, 7)}-01`, end: previousEnd },
    { label: "Улирал", start: `${today.slice(0, 4)}-${String(quarterMonth).padStart(2, "0")}-01`, end: today },
  ];
  function exportCsv() {
    const cell = (value: string | number) => {
      let text = String(value);
      if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [["Нэр", "Клуб", "Event", ...STATUS.map(s => s.label), "Ирц %"], ...people.map(p => [
      `${p.member.first_name} ${p.member.last_name}`, clubs.find(c => c.id === p.member.club_id)?.name ?? "", p.events, ...STATUS.map(s => p.counts[s.key]), p.rate === null ? "" : p.rate.toFixed(1),
    ])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `irts-${from}-${to}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="cr"><div className="cr-page">
    <header className="cr-hero">
      <div className="cr-hero-top"><div><div className="cr-eyebrow"><ActivityIcon className="size-4" /> Club report</div><h1>Бэлтгэл &amp; ирцийн тайлан</h1><p>{clubName} · Багийн оролцоо, тогтмол ирц, хоцролтын нэгтгэл</p></div><Link href="/admin/club-events" className="cr-btn-ghost"><CalendarDaysIcon className="size-4" />Календарь<ArrowUpRightIcon className="size-3.5" /></Link></div>
      <div className="cr-hero-meta"><span className="cr-chip"><CalendarDaysIcon className="size-4" /><b>{from.replaceAll("-", ".")} – {to.replaceAll("-", ".")}</b></span><span className="cr-chip"><b>{selectedMembers.length}</b><span>{scope === "players" ? "тоглогч" : scope === "staff" ? "ажилтан" : "гишүүн"}</span></span><span className="cr-chip"><b>{report.completed}</b><span>дууссан event</span></span><span className="cr-chip"><b>{report.upcoming}</b><span>төлөвлөсөн / дуусаагүй</span></span></div>
    </header>
    <section className="cr-card" aria-label="Шүүлтүүр">
      <form action="/admin/club-reports" className="cr-filters"><input type="hidden" name="scope" value={scope} />
        <label className="cr-field"><span>Клуб</span>{isAdmin ? <select name="club" defaultValue={clubId} className="cr-input"><option value="all">Бүх клуб</option>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <span className="cr-input">{clubName}</span>}</label>
        <label className="cr-field"><span>Event төрөл</span><select name="eventType" className="cr-input" value={eventType} onChange={e => { setEventType(e.target.value); setTablePage(0); setEventLimit(10); }}><option value="all">Бүх event</option><option value="training">Зөвхөн бэлтгэл</option>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="cr-field"><span>Хугацаа</span><div className="cr-range"><input className="cr-input num" aria-label="Эхлэх огноо" type="date" name="from" defaultValue={from} required /><input className="cr-input num" aria-label="Дуусах огноо" type="date" name="to" defaultValue={to} required /></div></div>
        <div className="cr-field"><span>Хамрах хүрээ</span><div className="cr-seg" role="group" aria-label="Оролцогчдын төрөл">{[["players", "Тоглогч"], ["staff", "Ажилтан"], ["all", "Бүгд"]].map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => { setScope(value); setTablePage(0); }}>{label}</button>)}</div></div>
        <button className="cr-btn" type="submit">Тайлан харах</button>
      </form>
      <div className="cr-presets">{presets.map(p => <Link key={p.label} href={`/admin/club-reports?club=${encodeURIComponent(clubId)}&from=${p.start}&to=${p.end}&eventType=${eventType}&scope=${scope}`} className="cr-preset" aria-current={from === p.start && to === p.end ? "date" : undefined} style={from === p.start && to === p.end ? { borderColor: "var(--brand)", color: "var(--brand)", background: "var(--brand-soft)" } : undefined}>{p.label}</Link>)}</div>
    </section>
    <section className="cr-kpis" aria-label="Гол үзүүлэлт">
      <article className="cr-card cr-kpi"><div className="cr-kpi-l">Дууссан бэлтгэл</div><div className="cr-kpi-v">{report.trainingCount}<small>/ {filteredEvents.filter(e => ["gym_prep", "fitness_prep"].includes(e.event_type)).length}</small></div><div className="cr-kpi-f">{report.trainingHours.toFixed(1)} цаг · дунджаар {report.trainingCount ? (report.trainingHours / report.trainingCount).toFixed(1) : "—"} цаг</div></article>
      <article className="cr-card cr-kpi"><div className="cr-kpi-l">Ирцийн хувь</div><div className="cr-kpi-v">{pct(report.rate)}</div><div className="cr-kpi-bar" aria-hidden="true"><i className="cr-fill s-present" style={{ width: `${report.rate ?? 0}%` }} /></div><div className="cr-kpi-f">{participating} / {required} тооцох бүртгэл</div></article>
      <article className="cr-card cr-kpi"><div className="cr-kpi-l">Хоцролт<span className="cr-dot s-late" /></div><div className="cr-kpi-v">{report.total.late}<small>удаа</small></div><div className="cr-kpi-f">Оролцсон бүртгэлийн {participating ? (report.total.late / participating * 100).toFixed(1) + "%" : "—"}</div></article>
      <article className="cr-card cr-kpi"><div className="cr-kpi-l">Таслалт<span className="cr-dot s-absent" /></div><div className="cr-kpi-v">{report.total.absent}<small>удаа</small></div><div className="cr-kpi-f"><span><i className="cr-dot s-excused" /> {report.total.excused} чөлөөтэй</span><span><i className="cr-dot s-sick" /> {report.total.sick} өвчтэй</span></div></article>
    </section>
    <div className="cr-row2">
      <section className="cr-card"><div className="cr-card-h"><div><h2 className="cr-card-t">Оролцооны хандлага</h2><p className="cr-card-s">Сүүлийн 14 дууссан event · ирсэн + хоцорсон</p></div><div className="cr-legend"><span><i className="cr-sw s-present" />≥90%</span><span><i className="cr-sw s-late" />&lt;90%</span><span><i className="cr-sw dash" />Зорилт 90%</span></div></div>
        <div className="cr-card-b">{!trend.length ? <p className="py-20 text-center cr-card-s">Энэ хугацаанд дууссан event алга.</p> : <div className="cr-trend" style={{ paddingTop: 18 }}>
          <div className="cr-yaxis">{[0,25,50,75,100].map(value => <span key={value} style={{ top: `${100 - value}%` }}>{value}%</span>)}</div>
          <div className="cr-plot">{[25,50,75].map(value => <div key={value} className="cr-grid" style={{ top: `${value}%` }} />)}<div className="cr-target" style={{ top: "10%", pointerEvents: "none" }} /><div className="cr-bars">{trend.map(row => <Link key={row.event.id} href={`/admin/club-events/${row.event.id}/attendance`} className={`cr-bar ${row.rate === null ? "none" : row.rate < 90 ? "s-late low" : "s-present"}`} title={`${row.event.name}: ${pct(row.rate)}`} aria-label={`${row.event.name}, ${calendarDay(row.event.start_at)}, ирц ${pct(row.rate)}`}><b style={{ bottom: `calc(${row.rate ?? 100}% + 4px)` }}>{pct(row.rate)}</b><i style={{ height: `${row.rate ?? 100}%`, minHeight: 2 }} /></Link>)}</div></div>
          <div className="cr-xaxis">{trend.map(row => <span key={row.event.id}>{calendarDay(row.event.start_at).slice(5).replace("-", ".")}<small>{new Date(row.event.start_at).toLocaleTimeString("en-GB", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}</small></span>)}</div>
        </div>}<p className="cr-card-s" style={{ marginTop: 12 }}>Баганад дарж ирц нээнэ. Зураасан багана — хувь тооцох бүртгэлгүй.</p></div>
      </section>
      <section className="cr-card"><div className="cr-card-h"><div><h2 className="cr-card-t">Ирцийн бүтэц</h2><p className="cr-card-s">Дууссан event-үүдийн бүх бүртгэл</p></div></div><div className="cr-card-b"><div className="cr-bd-total"><b>{report.marked}</b><span>/ {report.expected} бүртгэл тэмдэглэгдсэн ({report.expected ? pct(report.marked / report.expected * 100) : "—"})</span></div><StatusBar counts={report.total} /><ul className="cr-bd-list">{STATUS.map(s => <li key={s.key}><span className={`cr-dot s-${s.key}`} /><span>{s.label}{["sick","excused"].includes(s.key) && <span className="x">ирээгүй</span>}</span><span className="n">{report.total[s.key]}</span><span className="p">{report.expected ? (report.total[s.key] / report.expected * 100).toFixed(1) + "%" : "—"}</span></li>)}</ul>{report.total.unmarked > 0 && <div className="cr-callout"><span>{report.total.unmarked} бүртгэл бөглөөгүй — тасалсанд тооцоогүй.</span><a href="#attendance-events">Нөхөх →</a></div>}</div></section>
    </div>
    <section className="cr-card"><div className="cr-card-h"><div><h2 className="cr-card-t">Гишүүдийн ирц <span className="cr-badge num">{people.length}</span></h2><p className="cr-card-s">Баганын нэр дээр дарж эрэмбэлнэ · мөр дээр дарж дэлгэрэнгүй</p></div><div className="cr-tbl-tools"><label className="cr-search"><SearchIcon className="size-4" /><input value={search} onChange={e => { setSearch(e.target.value); setTablePage(0); }} placeholder="Нэрээр хайх" aria-label="Гишүүний нэрээр хайх" /></label><div className="cr-seg" role="group" aria-label="Анхаарах гишүүд" title="Тасалсан эсвэл ирц 90%-аас бага"><button type="button" aria-pressed={!attentionOnly} onClick={() => { setAttentionOnly(false); setTablePage(0); }}>Бүгд</button><button type="button" aria-pressed={attentionOnly} onClick={() => { setAttentionOnly(true); setTablePage(0); }}>Анхаарах</button></div><button className="cr-btn cr-btn-2" type="button" onClick={exportCsv}><DownloadIcon className="size-4" />CSV</button></div></div>
      <div className="cr-tbl-wrap"><table className="cr-tbl"><thead><tr>{columns.map(c => <th key={c.key} scope="col" aria-sort={sort === c.key ? direction === "asc" ? "ascending" : "descending" : "none"}><button type="button" onClick={() => changeSort(c.key)}>{STATUS.some(s => s.key === c.key) && <span className={`cr-dot s-${c.key}`} />}{c.label}<span aria-hidden="true">{sort === c.key ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead><tbody>{people.slice(page * 15, page * 15 + 15).map(p => <tr key={p.member.id} className={p.counts.absent > 0 || (p.rate !== null && p.rate < 90) ? "flag" : ""} onClick={() => setSelectedMemberId(p.member.id)}><td><div className="cr-who"><span className="cr-av">{p.member.first_name.slice(0,1)}{p.member.last_name.slice(0,1)}</span><div><button type="button" aria-haspopup="dialog" onClick={e => { e.stopPropagation(); setSelectedMemberId(p.member.id); }}><b>{p.member.first_name} {p.member.last_name}</b></button><small>{ROLES[p.member.role]} · {clubs.find(c => c.id === p.member.club_id)?.name}</small></div></div></td><td>{p.events}</td>{STATUS.map(s => <td key={s.key} className={p.counts[s.key] ? `nz s-${s.key}` : "z"}>{p.counts[s.key] || "—"}</td>)}<td><div className="cr-rate"><StatusBar counts={p.counts} /><b>{pct(p.rate)}</b></div></td></tr>)}{!people.length && <tr><td colSpan={columns.length}>Тохирох гишүүн олдсонгүй.</td></tr>}</tbody></table></div>
      <div className="cr-tbl-foot"><span>Нийт {people.length} гишүүн · {people.length ? page * 15 + 1 : 0}–{Math.min((page + 1) * 15, people.length)}</span><div className="flex gap-2"><button className="cr-btn cr-btn-2" type="button" disabled={page === 0} onClick={() => setTablePage(page - 1)}>Өмнөх</button><button className="cr-btn cr-btn-2" type="button" disabled={(page + 1) * 15 >= people.length} onClick={() => setTablePage(page + 1)}>Дараах</button></div></div>
    </section>

    <section id="attendance-events" className="cr-card p-5"><h2 className="font-semibold">Event-ийн дэлгэрэнгүй</h2><p className="mt-1 text-xs text-muted-foreground">Ирцийн бүртгэл, тэмдэглэл · Шинээс хуучин руу</p><div className="mt-4 divide-y">
      {[...report.eventRows].reverse().slice(0, eventLimit).map((row) => <Link key={row.event.id} href={`/admin/club-events/${row.event.id}/attendance`} className="flex flex-wrap items-center gap-4 rounded-lg py-4 transition-colors hover:bg-muted/30"><div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted"><span className="text-[9px] text-muted-foreground">{calendarDay(row.event.start_at).slice(5, 7)} САР</span><span className="text-lg font-semibold leading-5">{calendarDay(row.event.start_at).slice(8)}</span></div><div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium">{row.event.name}<ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground" /></p><p className="mt-1 text-xs text-muted-foreground">{TYPES[row.event.event_type]} · {new Date(row.event.start_at).toLocaleTimeString("en-GB", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit" })}{clubId === "all" && ` · ${clubs.find((c) => c.id === row.event.club_id)?.name ?? ""}`}</p>{row.event.description && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{row.event.description}</p>}</div><div className="w-40 shrink-0">{row.completed ? <><div className="mb-2 flex justify-between text-xs"><span className="text-muted-foreground">Оролцсон {row.counts.present + row.counts.late}</span><span className="font-semibold">{pct(row.rate)}</span></div><StatusBar counts={row.counts} /></> : <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-600">Дуусаагүй / төлөвлөсөн</span>}</div></Link>)}
      {report.eventRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Сонгосон хугацаа, төрөлд event олдсонгүй.</p>}
    </div>{report.eventRows.length > eventLimit && <Button variant="outline" className="mt-4 w-full" onClick={() => setEventLimit((n) => n + 10)}>Дараагийн 10 event харах</Button>}</section>

    <Dialog open={!!selectedPerson} onOpenChange={open => { if (!open) setSelectedMemberId(null); }}>
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{selectedPerson?.member.first_name} {selectedPerson?.member.last_name} · Ирцийн дэлгэрэнгүй</DialogTitle>
          <DialogDescription>{from} — {to} · {eventType === "all" ? "Бүх event" : eventType === "training" ? "Зөвхөн бэлтгэл" : TYPES[eventType as ClubEventType]} · Сонгосон хугацаа, төрлийн бүх бүртгэл</DialogDescription>
        </DialogHeader>
        {selectedPerson && <>
          <div className="flex flex-wrap gap-2 rounded-lg bg-muted/40 p-3">
            <span className="rounded border bg-background px-3 py-2 font-semibold">Ирц {pct(selectedPerson.rate)}</span>
            {STATUS.map(s => <span key={s.key} className="inline-flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs"><span className={cn("size-2 rounded-full", s.bg)} />{s.label}: <strong>{selectedPerson.counts[s.key]}</strong></span>)}
          </div>
          <p className="text-xs text-muted-foreground">Нэгтгэлд зөвхөн дууссан event-үүдийг тооцсон. Цаг: Улаанбаатар.</p>
          <div className="min-h-0 overflow-auto rounded-lg border">
            <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-muted"><tr>{["Огноо / цаг", "Бэлтгэл / event", "Байрлал", "Ирц"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
              <tbody>{details.map(({ event, status, completed }) => {
                const display = STATUS.find(s => s.key === status)!;
                const time = (date: string) => new Date(date).toLocaleTimeString("en-GB", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
                return <tr key={event.id} className="border-t align-top hover:bg-muted/20">
                  <td className="whitespace-nowrap px-3 py-3"><p>{calendarDay(event.start_at)}</p><p className="mt-1 text-xs text-muted-foreground">{time(event.start_at)}–{calendarDay(event.end_at) !== calendarDay(event.start_at) ? `${calendarDay(event.end_at)} ` : ""}{time(event.end_at)}</p></td>
                  <td className="px-3 py-3"><Link className="font-medium text-emerald-700 hover:underline dark:text-emerald-300" href={`/admin/club-events/${event.id}/attendance`}>{event.name} ↗</Link><p className="mt-1 text-xs text-muted-foreground">{TYPES[event.event_type]}</p>{event.description && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{event.description}</p>}</td>
                  <td className="px-3 py-3">{event.location || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-2"><span className={cn("size-2 rounded-full", display.bg)} />{!completed && status === "unmarked" ? "Хүлээгдэж байна" : display.label}</span>{!completed && <p className="mt-1 text-xs text-blue-500">Дуусаагүй / төлөвлөсөн</p>}</td>
                </tr>;
              })}</tbody>
            </table>
            {!details.length && <p className="p-8 text-center text-muted-foreground">Сонгосон хугацаа, төрөлд энэ гишүүний бүртгэл алга.</p>}
          </div>
        </>}
      </DialogContent>
    </Dialog>

    <p className="cr-footer-note">Ирц % = (ирсэн + хоцорсон) ÷ (ирсэн + хоцорсон + тасалсан + чөлөөтэй + өвчтэй). Чөлөөтэй, өвчтэй, тасалсан нь ирээгүйд тооцогдож ирцийн хувийг бууруулна. Зөвхөн бөглөөгүй ирцийг хувийн тооцоонд оруулахгүй. Тухайн хугацаанд эхэлсэн, дууссан event-үүд болон одоогийн гишүүдийг тооцно. Event-ээс хойш бүртгүүлсэн хүний ирцийг нөхөж таамаглахгүй. Бэлтгэлийн цаг нь хуваарийн үргэлжлэх хугацаа; идэвхийг ирцийн оролцоогоор харуулсан.</p>
  </div></div>;
}
