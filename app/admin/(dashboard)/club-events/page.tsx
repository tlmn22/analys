import { supabaseAdmin } from "@/lib/supabase/server";
import type { Club, ClubEventWithClub } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ClubEventFormDialog } from "@/components/admin/club-event-form-dialog";
import { PlusIcon } from "lucide-react";
import { getEventEditor } from "@/lib/club-event-access";
import { redirect } from "next/navigation";
import { ClubEventsCalendar } from "@/components/admin/club-events-calendar";
import { calendarDay } from "@/lib/club-event-calendar";
import Link from "next/link";


export default async function ClubEventsPage() {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const isAdmin = editor.role === "superadmin";
  const db = supabaseAdmin();
  let eventsQuery = db.from("club_events")
    .select("id, club_id, name, event_type, location, start_at, end_at, description, created_at, club:clubs(id, name)")
    .order("start_at", { ascending: false });
  if (editor.role === "club_staff") eventsQuery = eventsQuery.eq("club_id", editor.clubId);
  let clubsQuery = db.from("clubs").select("id, name").order("name");
  if (editor.role === "club_staff") clubsQuery = clubsQuery.eq("id", editor.clubId);

  const [eventsRes, clubsRes] = await Promise.all([
    eventsQuery.returns<ClubEventWithClub[]>(),
    clubsQuery.returns<Pick<Club, "id" | "name">[]>(),
  ]);

  if (eventsRes.error) {
    return <p className="text-sm text-destructive">Алдаа: {eventsRes.error.message}</p>;
  }

  const events = eventsRes.data ?? [];
  const clubs = clubsRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Клубын эвентүүд</h1>
          <p className="text-sm text-muted-foreground">
            Тоглогч, ажилтнуудын ирц болон эвентийн тайлбарыг бүртгэнэ. Нийт {events.length} эвент зарлагдсан.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/club-reports" />}>Ирцийн тайлан</Button>
        <ClubEventFormDialog
          clubs={clubs}
          trigger={
            <Button disabled={clubs.length === 0}>
              <PlusIcon />
              Эвент зарлах
            </Button>
          }
        />
        </div>
      </div>

      {isAdmin && clubs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Эхлээд дор хаяж нэг клуб бүртгэнэ үү (Клубууд хэсэгт).
        </p>
      )}

      <ClubEventsCalendar events={events} clubs={clubs} isAdmin={isAdmin} today={calendarDay(new Date())} />
    </div>
  );
}
