import { redirect } from "next/navigation";
import { getPackageRecipient } from "@/lib/package-recipient-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { PlayerEvent } from "@/components/player/schedule-list";
import { TrainingCalendar } from "@/components/player/training-calendar";
import { calendarDay, monthDays } from "@/lib/club-event-calendar";

export default async function PlayerSchedule({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const member = await getPackageRecipient();
  if (!member) redirect("/admin/login");
  const query = await searchParams;
  // Capture one request timestamp for this dynamic server-rendered calendar.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const today = calendarDay(new Date(now));
  const month = query.month && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : today.slice(0, 7);
  const days = monthDays(month);
  const from = new Date(`${days[0]}T00:00:00+08:00`).toISOString();
  const until = new Date(Date.parse(`${days[41]}T00:00:00+08:00`) + 86400000).toISOString();
  const events: PlayerEvent[] = [];
  const db = supabaseAdmin();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("club_events")
      .select("id,name,event_type,start_at,end_at,location,description").eq("club_id", member.club_id)
      .in("event_type", ["gym_prep", "fitness_prep"]).gte("end_at", from).lt("start_at", until)
      .order("start_at").order("id").range(offset, offset + 499);
    if (error) return <main className="p-5"><p role="alert">Календарийг ачаалж чадсангүй. Хуудсаа дахин ачаална уу.</p></main>;
    events.push(...(data ?? []) as PlayerEvent[]);
    if ((data?.length ?? 0) < 500) break;
  }
  return <main className="space-y-5 p-4 sm:p-6"><header><h1 className="text-2xl font-semibold">Calendar</h1><p className="mt-2 text-sm text-muted-foreground">Өөрийн клубын бүх бэлтгэл · Өдөр дээр дарж дэлгэрэнгүйг үзнэ</p></header><TrainingCalendar key={month} events={events} month={month} today={today} now={now} /></main>;
}
