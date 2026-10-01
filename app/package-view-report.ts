"use server";
import { getEventEditor } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export type ViewReportMember = { id: string; first_name: string; last_name: string; role: string };
export type ViewReportItem = { id: string; event: { event_type: string; period: number; clock_time: number } | null };
export type ViewReportRow = { memberId: string; itemId: string; count: number; lastViewed: string };
export type PackageViewReportData = { members: ViewReportMember[]; items: ViewReportItem[]; progress: ViewReportRow[] };

export async function loadPackageViewReport(packageId: string): Promise<{ data?: PackageViewReportData; error?: string }> {
  const editor = await getEventEditor();
  if (!editor) return { error: "Үзэлтийн тайлан харах эрхгүй байна." };
  if (!/^[0-9a-f-]{36}$/i.test(packageId)) return { error: "Багцын ID буруу байна." };
  const db = supabaseAdmin();
  const assignments: { id: string; member: ViewReportMember }[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db.from("event_package_assignments")
      .select("id,member:club_staff!inner(id,first_name,last_name,role,club_id)").eq("package_id", packageId);
    if (editor.role === "club_staff") query = query.eq("member.club_id", editor.clubId);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) return { error: "Хуваарилсан гишүүдийг ачаалж чадсангүй." };
    assignments.push(...(data ?? []) as unknown as typeof assignments);
    if ((data?.length ?? 0) < 500) break;
  }
  if (editor.role === "club_staff" && !assignments.length) return { error: "Энэ багцын тайланг харах эрхгүй байна." };
  const items: ViewReportItem[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("event_package_items")
      .select("id,event:game_events(event_type,period,clock_time)").eq("package_id", packageId)
      .order("created_at").order("id").range(offset, offset + 499);
    if (error) return { error: "Event-үүдийг ачаалж чадсангүй." };
    items.push(...(data ?? []) as unknown as ViewReportItem[]);
    if ((data?.length ?? 0) < 500) break;
  }
  const progress = new Map<string, ViewReportRow>();
  const memberByAssignment = new Map(assignments.map(a => [a.id, a.member.id]));
  for (let batch = 0; batch < assignments.length; batch += 100) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("event_package_views")
        .select("assignment_id,item_id,completed,updated_at")
        .in("assignment_id", assignments.slice(batch, batch + 100).map(a => a.id))
        .order("run_id").range(offset, offset + 499);
      if (error) return { error: "Үзэлтийн мэдээллийг ачаалж чадсангүй. 032_package_views.sql migration ажилласан эсэхийг шалгана уу." };
      for (const row of data ?? []) {
        const memberId = memberByAssignment.get(row.assignment_id);
        if (!memberId) continue;
        const key = `${memberId}:${row.item_id}`;
        const entry = progress.get(key) ?? { memberId, itemId: row.item_id, count: 0, lastViewed: "" };
        if (row.completed) entry.count++;
        if (row.updated_at > entry.lastViewed) entry.lastViewed = row.updated_at;
        progress.set(key, entry);
      }
      if ((data?.length ?? 0) < 500) break;
    }
  }
  return { data: { members: assignments.map(a => a.member), items, progress: [...progress.values()] } };
}
