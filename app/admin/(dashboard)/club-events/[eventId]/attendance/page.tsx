import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AttendanceStatus, ClubEventAttendance, ClubEventWithClub, ClubStaffWithClub } from "@/lib/types";
import { EVENT_TYPE_LABELS } from "@/components/admin/club-event-form-dialog";
import { ClubEventAttendanceForm, type AttendanceRow } from "@/components/admin/club-event-attendance-form";
import { getEventEditor } from "@/lib/club-event-access";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("mn-MN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ClubEventAttendancePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const db = supabaseAdmin();

  const { data: event, error: eventError } = await db
    .from("club_events")
    .select("id, club_id, name, event_type, location, start_at, end_at, description, created_at, club:clubs(id, name)")
    .eq("id", eventId)
    .maybeSingle()
    .returns<ClubEventWithClub>();

  if (eventError) return <p className="text-sm text-destructive">Эвент ачаалахад алдаа гарлаа: {eventError.message}</p>;
  if (!event || (editor.role !== "superadmin" && editor.clubId !== event.club_id)) notFound();

  const [staffRes, attendanceRes] = await Promise.all([
    db
      .from("club_staff")
      .select("id, club_id, first_name, last_name, email, role, created_at, club:clubs(id, name)")
      .eq("club_id", event.club_id)
      .order("first_name")
      .returns<ClubStaffWithClub[]>(),
    db
      .from("club_event_attendance")
      .select("*")
      .eq("event_id", eventId)
      .returns<ClubEventAttendance[]>(),
  ]);

  if (staffRes.error || attendanceRes.error) {
    return <p className="text-sm text-destructive">Ирц ачаалахад алдаа гарлаа: {staffRes.error?.message ?? attendanceRes.error?.message}</p>;
  }

  const staff = staffRes.data ?? [];
  const statusByStaffId = new Map((attendanceRes.data ?? []).map((a) => [a.club_staff_id, a.status]));

  const rows: AttendanceRow[] = staff.map((s) => ({
    staffId: s.id,
    name: `${s.first_name} ${s.last_name}`,
    role: s.role,
    status: (statusByStaffId.get(s.id) ?? null) as AttendanceStatus | null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/club-events"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Клубын эвентүүд рүү буцах
        </Link>
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {event.club?.name} · {EVENT_TYPE_LABELS[event.event_type]}
          {event.location && <> · {event.location}</>} · {fmt(event.start_at)} – {fmt(event.end_at)}
        </p>
      </div>

      <ClubEventAttendanceForm key={eventId} eventId={eventId} rows={rows} description={event.description ?? ""} />
    </div>
  );
}
