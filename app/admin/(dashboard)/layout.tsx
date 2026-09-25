import Image from "next/image";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { Separator } from "@/components/ui/separator";
import { getEventEditor } from "@/lib/club-event-access";
import { redirect } from "next/navigation";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  let name = "Системийн админ";
  let role = "Superadmin";
  let club = "Бүх клубын удирдлага";
  if (editor.role === "club_staff") {
    const db = supabaseAdmin();
    const [person, team] = await Promise.all([
      db.from("club_staff").select("first_name, last_name").eq("id", editor.staffId).eq("club_id", editor.clubId).maybeSingle(),
      db.from("clubs").select("name").eq("id", editor.clubId).maybeSingle(),
    ]);
    name = person.data ? `${person.data.last_name} ${person.data.first_name}`.trim() : "Клубын ажилтан";
    role = { owner: "Эзэмшигч", manager: "Менежер", head_coach: "Ахлах дасгалжуулагч", assistant_coach: "Туслах дасгалжуулагч", player: "Тоглогч" }[editor.staffRole];
    club = team.data?.name ?? "Клуб";
  }
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/20 p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Image
            src="/favicon.png"
            alt="HoopsLab"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-lg font-semibold">HoopsLab</span>
        </div>
        <SidebarNav eventsOnly={editor.role !== "superadmin"} />
        <Separator className="my-3" />
        <LogoutButton />
      </aside>
      <div className="min-w-0 flex-1">
        <AdminNavbar name={name} role={role} club={club} isAdmin={editor.role === "superadmin"} />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
