"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardCheckIcon, ClockIcon, MapPinIcon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClubEventFormDialog, EVENT_TYPE_LABELS } from "@/components/admin/club-event-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteClubEvent } from "@/app/admin/(dashboard)/club-events/actions";
import { CLUB_TIME_ZONE, calendarDay, eventOnDay, monthDays, shiftMonth } from "@/lib/club-event-calendar";
import { cn } from "@/lib/utils";
import type { Club, ClubEventType, ClubEventWithClub } from "@/lib/types";

const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];
const COLORS: Record<ClubEventType, string> = {
  gym_prep: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  fitness_prep: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  team_meeting: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  other: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", {
  timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit",
});
const fullDate = (iso: string) => new Date(iso).toLocaleString("mn-MN", {
  timeZone: CLUB_TIME_ZONE, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

export function ClubEventsCalendar({ events, clubs, isAdmin, today }: {
  events: ClubEventWithClub[];
  clubs: Pick<Club, "id" | "name">[];
  isAdmin: boolean;
  today: string;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const sortedEvents = [...events].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const days = monthDays(month);
  const dayEvents = new Map(days.map((day) => [day, sortedEvents.filter((event) => eventOnDay(event, day))]));
  const selectedEvents = sortedEvents.filter((event) => eventOnDay(event, selectedDay));
  const monthCount = events.filter((event) => days.some((day) => day.startsWith(month) && eventOnDay(event, day))).length;
  const monthLabel = `${month.slice(0, 4)} оны ${Number(month.slice(5))}-р сар`;

  function navigate(offset: number) {
    const next = shiftMonth(month, offset);
    setMonth(next);
    setSelectedDay(next === today.slice(0, 7) ? today : `${next}-01`);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="overflow-hidden rounded-xl border bg-background shadow-sm" aria-label="Эвентийн сарын календарь">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold" aria-live="polite"><CalendarDaysIcon className="size-5 text-blue-500" />{monthLabel}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{monthCount} эвент · Улаанбаатарын цагаар</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { const now = calendarDay(new Date()); setMonth(now.slice(0, 7)); setSelectedDay(now); }}>Өнөөдөр</Button>
            <Button variant="outline" size="icon" aria-label="Өмнөх сар" onClick={() => navigate(-1)}><ChevronLeftIcon /></Button>
            <Button variant="outline" size="icon" aria-label="Дараагийн сар" onClick={() => navigate(1)}><ChevronRightIcon /></Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {WEEKDAYS.map((day) => <div key={day} className="py-3 text-center text-xs font-medium text-muted-foreground">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const items = dayEvents.get(day) ?? [];
                const selected = day === selectedDay;
                return (
                  <div key={day} className={cn("min-h-32 min-w-0 border-b p-2", index % 7 !== 6 && "border-r", !day.startsWith(month) && "bg-muted/30", selected && "bg-blue-500/5 ring-2 ring-inset ring-blue-500/40")}>
                    <button type="button" onClick={() => setSelectedDay(day)} aria-pressed={selected} aria-label={`${day} — ${items.length} эвент`} aria-current={day === today ? "date" : undefined}
                      className={cn("mb-1 flex size-7 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-blue-500", day === today ? "bg-blue-600 text-white hover:bg-blue-700" : !day.startsWith(month) && "text-muted-foreground")}>
                      {Number(day.slice(8))}
                    </button>
                    <div className="flex flex-col gap-1">
                      {items.slice(0, 3).map((event) => (
                        <Link key={event.id} href={`/admin/club-events/${event.id}/attendance`}
                          title={`${event.name} · ${event.club?.name ?? ""} · ${fullDate(event.start_at)}`}
                          className={cn("block truncate rounded-md border px-1.5 py-1 text-xs transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-blue-500", COLORS[event.event_type])}>
                          <span className="mr-1 font-mono text-[10px]">{calendarDay(event.start_at) === day ? time(event.start_at) : "↳"}</span>{event.name}
                        </Link>
                      ))}
                      {items.length > 3 && <button type="button" onClick={() => setSelectedDay(day)} className="rounded px-1 py-1 text-left text-xs text-blue-600 hover:underline">+{items.length - 3} эвент харах</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 p-3">
          {(Object.keys(COLORS) as ClubEventType[]).map((type) => <span key={type} className={cn("rounded-full border px-2.5 py-1 text-[11px]", COLORS[type])}>{EVENT_TYPE_LABELS[type]}</span>)}
        </div>
      </section>

      <section aria-label="Сонгосон өдрийн эвентүүд" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold" aria-live="polite">{selectedDay.replaceAll("-", ".")} · {selectedEvents.length} эвент</h2>
        {selectedEvents.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Энэ өдөр эвент зарлагдаагүй байна. Календарийн өөр өдрийг сонгож болно.</p>}
        {selectedEvents.map((event) => (
          <article key={event.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link href={`/admin/club-events/${event.id}/attendance`} className="font-semibold hover:text-blue-500 hover:underline">{event.name}</Link>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", COLORS[event.event_type])}>{EVENT_TYPE_LABELS[event.event_type]}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{event.club?.name}</span>
                <span className="inline-flex items-center gap-1"><ClockIcon className="size-3.5" />{fullDate(event.start_at)} – {fullDate(event.end_at)}</span>
                {event.location && <span className="inline-flex items-center gap-1"><MapPinIcon className="size-3.5" />{event.location}</span>}
              </div>
              {event.description && <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.description}</p>}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/club-events/${event.id}/attendance`} />}><ClipboardCheckIcon />Ирц, тайлбар</Button>
              {isAdmin && <ClubEventFormDialog clubs={clubs} event={event} trigger={<Button variant="ghost" size="icon-sm" aria-label={`${event.name} — засах`}><PencilIcon /></Button>} />}
              {isAdmin && <DeleteButton action={deleteClubEvent.bind(null, event.id)} confirmText={`"${event.name}" эвентийг устгах уу?`} />}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
