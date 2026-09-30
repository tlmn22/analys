import { redirect } from "next/navigation";
import { clubPackageIds } from "@/lib/club-package-access";
import { getEventEditor } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EventPackageList, type PackageSummary } from "@/components/admin/event-package-list";

export default async function EventPackagesPage() {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const allowed = editor.role === "club_staff" ? new Set(await clubPackageIds(editor.clubId)) : null;
  const packages: PackageSummary[] = [];
  const db = supabaseAdmin();
  // Fetch all summaries so search, sorting and totals cover every package.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("event_packages")
      .select("id,name,description,created_at,event_package_items(count)")
      .order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) return <p role="alert" className="text-destructive">Багцуудыг ачаалж чадсангүй: {error.message}</p>;
    packages.push(...((data ?? []) as PackageSummary[]).filter(item => !allowed || allowed.has(item.id)));
    if ((data?.length ?? 0) < 500) break;
  }
  return <EventPackageList packages={packages} canManage={editor.role === "superadmin"} />;
}
