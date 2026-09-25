import { redirect } from "next/navigation";
import { getEventEditor } from "@/lib/club-event-access";
import { calendarDay } from "@/lib/club-event-calendar";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Club, ClubEvent } from "@/lib/types";
import type { ReportAttendance, ReportMember } from "@/lib/club-attendance-report";
import { ClubAttendanceReport } from "@/components/admin/club-attendance-report";

async function readAll<T>(query: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await query(start, start + 499);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export default async function ClubReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const params = await searchParams;
  const now = new Date().getTime();
  const today = calendarDay(new Date(now));
  const from = validDay(params.from) ? params.from : `${today.slice(0, 7)}-01`;
  const to = validDay(params.to) ? params.to : today;
  if ((params.from && !validDay(params.from)) || (params.to && !validDay(params.to)) || from > to) {
    return <p role="alert" className="rounded-xl border p-6 text-destructive">Огнооны хүрээ буруу байна. Эхлэх огноо дуусахаас хойш байж болохгүй. <a href="/admin/club-reports" className="underline">Шүүлтүүр шинэчлэх</a></p>;
  }
  const db = supabaseAdmin();
  let reportData: { clubs: Pick<Club, "id" | "name">[]; clubId: string; events: ClubEvent[]; members: ReportMember[]; attendance: ReportAttendance[] };
  try {
    const clubs = await readAll<Pick<Club, "id" | "name">>((start, end) => {
      let query = db.from("clubs").select("id, name").order("id");
      if (editor.role === "club_staff") query = query.eq("id", editor.clubId);
      return query.range(start, end);
    });
    const clubId = editor.role === "club_staff" ? editor.clubId
      : typeof params.club === "string" && clubs.some((c) => c.id === params.club) ? params.club : "all";
    const endDate = new Date(`${to}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const until = `${endDate.toISOString().slice(0, 10)}T00:00:00+08:00`;
    const [events, members] = await Promise.all([
      readAll<ClubEvent>((start, end) => {
        let query = db.from("club_events").select("id, club_id, name, event_type, location, start_at, end_at, description, created_at")
          .gte("start_at", `${from}T00:00:00+08:00`).lt("start_at", until).order("id");
        if (clubId !== "all") query = query.eq("club_id", clubId);
        return query.range(start, end);
      }),
      readAll<ReportMember>((start, end) => {
        let query = db.from("club_staff").select("id, club_id, first_name, last_name, role, created_at").order("id");
        if (clubId !== "all") query = query.eq("club_id", clubId);
        return query.range(start, end);
      }),
    ]);
    const attendance: ReportAttendance[] = [];
    for (let i = 0; i < events.length; i += 100) {
      const ids = events.slice(i, i + 100).map((e) => e.id);
      attendance.push(...await readAll<ReportAttendance>((start, end) => db.from("club_event_attendance")
        .select("event_id, club_staff_id, status").in("event_id", ids).order("id").range(start, end)));
    }
    reportData = { clubs, clubId, events, members, attendance };
  } catch {
    return <div role="alert" className="rounded-xl border p-6"><h1 className="font-semibold">Тайлан ачаалахад алдаа гарлаа</h1><p className="mt-2 text-sm text-muted-foreground">Өгөгдөл бүрэн ачаалагдаагүй тул дүн харуулаагүй. Хуудсаа дахин шинэчилнэ үү.</p></div>;
  }
  return <ClubAttendanceReport key={`${reportData.clubId}:${from}:${to}:${params.eventType}:${params.scope}`} {...reportData} initialEventType={typeof params.eventType === "string" && ["all", "training", "gym_prep", "fitness_prep", "team_meeting", "other"].includes(params.eventType) ? params.eventType : "all"} initialScope={typeof params.scope === "string" && ["players", "staff", "all"].includes(params.scope) ? params.scope : "players"} isAdmin={editor.role === "superadmin"} from={from} to={to} now={now} />;
}
