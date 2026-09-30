import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

// A package belongs to a club's viewing scope when assigned to one of its members.
export async function clubPackageIds(clubId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseAdmin().from("event_package_assignments")
      .select("id,package_id,member:club_staff!inner(club_id)")
      .eq("member.club_id", clubId).order("id").range(offset, offset + 499);
    if (error) throw new Error("Клубын бичлэгүүдийг ачаалж чадсангүй.");
    for (const row of data ?? []) ids.add(row.package_id);
    if ((data?.length ?? 0) < 500) return [...ids];
  }
}
