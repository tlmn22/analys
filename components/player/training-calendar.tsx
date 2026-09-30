"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { monthDays, shiftMonth, eventOnDay, CLUB_TIME_ZONE } from "@/lib/club-event-calendar";
import { ScheduleList, type PlayerEvent } from "./schedule-list";

const weekdays = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const time = (value: string) => new Date(value).toLocaleTimeString("en-GB", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
export function TrainingCalendar({ events, month, today, now }: { events: PlayerEvent[]; month: string; today: string; now: number }) {
  const [selected, setSelected] = useState(today.startsWith(month) ? today : `${month}-01`);
  const days = monthDays(month);
  const selectedEvents = events.filter(event => eventOnDay(event, selected));
  const monthCount = events.filter(event => days.some(day => day.startsWith(month) && eventOnDay(event, day))).length;
  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Бэлтгэлийн сарын календарь">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-semibold">{month.slice(0, 4)} оны {Number(month.slice(5))}-р сар</h2><p className="mt-1 text-xs text-muted-foreground">{monthCount} бэлтгэл · Улаанбаатарын цаг</p></div><div className="flex items-center gap-2"><Link href={`?month=${shiftMonth(month, -1)}`} aria-label="Өмнөх сар" className="rounded-lg border p-2"><ChevronLeftIcon className="size-4" /></Link><Link href={`?month=${today.slice(0, 7)}`} onClick={() => setSelected(today)} className="rounded-lg border px-3 py-2 text-xs">Өнөөдөр</Link><Link href={`?month=${shiftMonth(month, 1)}`} aria-label="Дараах сар" className="rounded-lg border p-2"><ChevronRightIcon className="size-4" /></Link></div></header>
      <div className="grid grid-cols-7 border-b bg-muted/40">{weekdays.map(day => <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">{day}</div>)}</div>
      <div className="grid grid-cols-7">{days.map(day => {
        const entries = events.filter(event => eventOnDay(event, day));
        return <button key={day} type="button" aria-label={`${day}, ${entries.length} бэлтгэл`} aria-pressed={day === selected} aria-current={day === today ? "date" : undefined} onClick={() => setSelected(day)} className={`min-h-15 min-w-0 border-b border-r p-1.5 text-left align-top last:border-r-0 sm:min-h-21 sm:p-2 ${day === selected ? "bg-emerald-600/10 ring-2 ring-inset ring-emerald-600" : "hover:bg-muted/50"} ${day.startsWith(month) ? "" : "bg-muted/30 text-muted-foreground"}`}>
          <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${day === today ? "bg-emerald-700 text-white" : ""}`}>{Number(day.slice(8))}</span>
          <div className="mt-1 space-y-1">{entries.slice(0, 2).map(event => <div key={event.id} className={`truncate rounded px-1 py-0.5 text-[10px] sm:text-xs ${event.event_type === "fitness_prep" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}><span>{time(event.start_at)}</span><span className="hidden sm:inline"> {event.name}</span></div>)}{entries.length > 2 && <span className="block text-[10px] text-muted-foreground">+{entries.length - 2}</span>}</div>
        </button>;
      })}</div>
      <div className="flex gap-4 p-3 text-xs text-muted-foreground"><span>🟢 Заалны бэлтгэл</span><span>🔵 Фитнесс</span></div>
    </section>
    <section className="space-y-3" aria-live="polite"><h2 className="font-semibold">{selected.replaceAll("-", ".")} · {selectedEvents.length} бэлтгэл</h2>{selectedEvents.length ? <ScheduleList events={selectedEvents} now={now} /> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Энэ өдөр бэлтгэл байхгүй.</p>}</section>
  </div>;
}
