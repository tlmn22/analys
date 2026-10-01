"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PackageViewReportData } from "@/app/package-view-report";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";
import { EDITABLE_EVENTS } from "@/lib/tag-events";

const date = (value: string) => value ? `${calendarDay(value)} ${calendarTime(value)}` : "—";
export function PackageViewReport({ data, error }: { data?: PackageViewReportData; error?: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  return <section className="space-y-4 rounded-xl border bg-card p-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Үзэлтийн тайлан</h2><p className="text-xs text-muted-foreground">Event-ийн 80%-ийг үзвэл «Үзсэн» гэж тоолно. Дахин үзэх товчоор давтан үзсэн тоог бүртгэнэ.</p></div><button type="button" onClick={() => router.refresh()} className="rounded-lg border px-3 py-2 text-sm">Шинэчлэх</button></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {data && <>
      {!data.members.length ? <p className="text-sm text-muted-foreground">Гишүүнд хуваарилаагүй байна.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr className="border-b"><th className="p-2">Гишүүн</th><th className="p-2">Үзсэн event</th><th className="p-2">Үзэлтийн тоо</th><th className="p-2">Сүүлд үзсэн · УБ</th></tr></thead>
        <tbody>{data.members.map(member => {
          const rows = data.progress.filter(row => row.memberId === member.id);
          const completed = rows.filter(row => row.count > 0).length;
          const last = rows.reduce((value, row) => row.lastViewed > value ? row.lastViewed : value, "");
          return <tr key={member.id} className="border-b last:border-0"><td className="p-2"><button type="button" aria-expanded={selected === member.id} onClick={() => setSelected(selected === member.id ? null : member.id)} className="text-left font-medium text-emerald-600 underline">{member.first_name} {member.last_name}</button></td><td className="p-2">{completed} / {data.items.length}{rows.length > completed && <span className="block text-xs text-muted-foreground">{rows.length - completed} дутуу үзсэн</span>}</td><td className="p-2">{rows.reduce((sum, row) => sum + row.count, 0)}</td><td className="p-2">{date(last)}</td></tr>;
        })}</tbody>
      </table></div>}
      {selected && <div className="max-h-96 overflow-auto rounded-lg border p-3"><h3 className="mb-3 font-medium">{data.members.find(m => m.id === selected)?.first_name} · Event бүрийн үзэлт</h3><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Event</th><th className="p-2">Төлөв</th><th className="p-2">Тоо</th><th className="p-2">Сүүлд үзсэн</th></tr></thead><tbody>{data.items.map((item, index) => {
        const row = data.progress.find(p => p.memberId === selected && p.itemId === item.id);
        const label = EDITABLE_EVENTS.find(e => e.type === item.event?.event_type)?.label ?? item.event?.event_type ?? "Event";
        return <tr key={item.id} className="border-t"><td className="p-2">{index + 1}. {label} · Q{item.event?.period}</td><td className="p-2">{row?.count ? "Үзсэн" : row ? "Дутуу үзсэн" : "Үзэлт бүртгэгдээгүй"}</td><td className="p-2">{row?.count ?? 0}</td><td className="p-2">{date(row?.lastViewed ?? "")}</td></tr>;
      })}</tbody></table></div>}
      <p className="text-xs text-muted-foreground">Бүртгэл идэвхжихээс өмнөх үзэлтүүд орохгүй. Нэр дээр дарж event бүрийн дэлгэрэнгүйг үзнэ.</p>
    </>}
  </section>;
}
