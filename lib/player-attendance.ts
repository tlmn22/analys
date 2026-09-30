import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildAttendanceReport, type ReportMember, type ReportAttendance } from "@/lib/club-attendance-report";
import type { ClubEvent } from "@/lib/types";

// The member is resolved from the session by the server page, never a URL parameter.
export async function getPlayerAttendance(member: ReportMember, now: number) {
  const db = supabaseAdmin();
  const cutoff = new Date(now).toISOString();
  const events: ClubEvent[] = [];
  const attendance: ReportAttendance[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("club_events").select("id,club_id,start_at,end_at,event_type")
      .eq("club_id", member.club_id).lte("end_at", cutoff).order("id").range(offset, offset + 499);
    if (error) return { error: "Ирцийн мэдээллийг ачаалж чадсангүй." };
    events.push(...(data ?? []) as ClubEvent[]);
    if ((data?.length ?? 0) < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("club_event_attendance")
      .select("event_id,club_staff_id,status,event:club_events!inner(club_id,end_at)")
      .eq("club_staff_id", member.id).eq("event.club_id", member.club_id).lte("event.end_at", cutoff)
      .order("id").range(offset, offset + 499);
    if (error) return { error: "Ирцийн мэдээллийг ачаалж чадсангүй." };
    attendance.push(...(data ?? []) as ReportAttendance[]);
    if ((data?.length ?? 0) < 500) break;
  }
  const report = buildAttendanceReport(events, [member], attendance, now);
  return { counts: report.total, rate: report.rate, total: report.expected, marked: report.marked };
}
