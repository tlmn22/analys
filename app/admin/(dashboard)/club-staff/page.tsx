import { supabaseAdmin } from "@/lib/supabase/server";
import { getEventEditor } from "@/lib/club-event-access";
import { redirect } from "next/navigation";
import type { Club, ClubStaffWithClub } from "@/lib/types";
import { ClubStaffTable } from "@/components/admin/club-staff-table";

export default async function ClubStaffPage() {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const isAdmin = editor.role === "superadmin";
  const db = supabaseAdmin();
  let staffQuery = db.from("club_staff")
    .select("id, club_id, first_name, last_name, email, role, created_at, club:clubs(id, name)")
    .order("created_at", { ascending: false });
  let clubsQuery = db.from("clubs").select("id, name").order("name");
  if (editor.role === "club_staff") {
    staffQuery = staffQuery.eq("club_id", editor.clubId);
    clubsQuery = clubsQuery.eq("id", editor.clubId);
  }
  const [staffRes, clubsRes] = await Promise.all([
    staffQuery.returns<ClubStaffWithClub[]>(),
    clubsQuery.returns<Pick<Club, "id" | "name">[]>(),
  ]);

  if (staffRes.error) {
    return <p className="text-sm text-destructive">Алдаа: {staffRes.error.message}</p>;
  }

  const staff = staffRes.data ?? [];
  const clubs = clubsRes.data ?? [];

  return <ClubStaffTable staff={staff} clubs={clubs} isAdmin={isAdmin} />;
}
