"use server";
import { getPackageRecipient } from "@/lib/package-recipient-access";
import { requireSuperadmin } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function recordPackageView(itemId: string, runId: string, watched: number, duration: number) {
  const member = await getPackageRecipient();
  if (!member) return { error: "Нэвтрэх шаардлагатай." };
  if (!uuid.test(itemId) || !uuid.test(runId) || !Number.isFinite(watched) || !Number.isFinite(duration) || duration <= 0 || watched < 0 || watched > duration + .01) return { error: "Үзэлтийн мэдээлэл буруу байна." };
  const { data, error } = await supabaseAdmin().rpc("record_package_view", { p_member: member.id, p_item: itemId, p_run: runId, p_watched: watched, p_duration: duration });
  if (error) return { error: "Үзэлтийг хадгалж чадсангүй." };
  return { completed: data as boolean };
}

export type ViewProgress = { memberId: string; itemId: string; count: number; lastViewed: string; started: boolean };
export async function getPackageViewProgress(packageId: string, admin = false) {
  let memberId: string | undefined;
  if (admin) await requireSuperadmin();
  else { const member = await getPackageRecipient(); if (!member) return { error: "Нэвтрэх шаардлагатай." }; memberId = member.id; }
  if (!uuid.test(packageId)) return { error: "Багц буруу байна." };
  const progress = new Map<string, ViewProgress>();
  for (let offset = 0; ; offset += 500) {
    let query = supabaseAdmin().from("event_package_views").select("run_id,item_id,completed,updated_at,assignment:event_package_assignments!inner(member_id,package_id)")
      .eq("assignment.package_id", packageId);
    if (memberId) query = query.eq("assignment.member_id", memberId);
    const { data, error } = await query.order("run_id").range(offset, offset + 499);
    if (error) return { error: "Үзэлтийн мэдээллийг ачаалж чадсангүй." };
    for (const raw of data ?? []) {
      const row = raw as unknown as { item_id: string; completed: boolean; updated_at: string; assignment: { member_id: string } };
      const key = `${row.assignment.member_id}:${row.item_id}`;
      const entry = progress.get(key) ?? { memberId: row.assignment.member_id, itemId: row.item_id, count: 0, lastViewed: "", started: true };
      if (row.completed) entry.count++;
      if (row.updated_at > entry.lastViewed) entry.lastViewed = row.updated_at;
      progress.set(key, entry);
    }
    if ((data?.length ?? 0) < 500) break;
  }
  return { progress: [...progress.values()] };
}
