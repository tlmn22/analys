"use server";

import { requireSuperadmin } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function loadPackageRecipients(packageId: string) {
  await requireSuperadmin();
  if (!uuid.test(packageId)) return { error: "Багцын ID буруу байна." };
  const db = supabaseAdmin();
  const members: { id: string; club_id: string; first_name: string; last_name: string; role: string }[] = [];
  // Supabase limits a single response; include the full roster.
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("club_staff").select("id,club_id,first_name,last_name,role").order("id").range(offset, offset + 499);
    if (result.error) return { error: result.error.message };
    members.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }
  const assigned: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("event_package_assignments").select("member_id").eq("package_id", packageId).order("id").range(offset, offset + 499);
    if (result.error) return { error: result.error.message };
    assigned.push(...(result.data ?? []).map(row => row.member_id));
    if ((result.data?.length ?? 0) < 500) break;
  }
  const clubs: { id: string; name: string }[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await db.from("clubs").select("id,name").order("id").range(offset, offset + 499);
    if (result.error) return { error: result.error.message };
    clubs.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }
  return { members, clubs, assigned };
}

export async function assignPackage(packageId: string, memberIds: string[]) {
  await requireSuperadmin();
  if (!uuid.test(packageId) || !Array.isArray(memberIds) || !memberIds.length || memberIds.length > 1000 || memberIds.some(id => typeof id !== "string" || !uuid.test(id))) return { error: "1–1000 гишүүн сонгоно уу." };
  const ids = [...new Set(memberIds)];
  // Foreign keys validate all recipients; one failed row rolls back the entire batch.
  const { data, error } = await supabaseAdmin().from("event_package_assignments")
    .upsert(ids.map(member_id => ({ package_id: packageId, member_id })), { onConflict: "package_id,member_id", ignoreDuplicates: true }).select("member_id");
  if (error) return { error: error.message };
  revalidatePath(`/admin/event-packages/${packageId}`);
  revalidatePath("/my-packages");
  return { success: true, added: data?.length ?? 0 };
}

export async function unassignPackage(packageId: string, memberId: string) {
  await requireSuperadmin();
  if (!uuid.test(packageId) || !uuid.test(memberId)) return { error: "ID буруу байна." };
  const { error } = await supabaseAdmin().from("event_package_assignments").delete().eq("package_id", packageId).eq("member_id", memberId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/event-packages/${packageId}`);
  revalidatePath("/my-packages");
  return { success: true };
}
