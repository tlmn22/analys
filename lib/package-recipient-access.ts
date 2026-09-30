import "server-only";
import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ClubStaffRole } from "@/lib/types";

export async function getPackageRecipient() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (session?.role !== "club_staff") return null;
  const { data, error } = await supabaseAdmin().from("club_staff").select("id,club_id,first_name,last_name,role,created_at").eq("id", session.staffId).maybeSingle();
  if (error || !data || !["player", "owner", "manager", "head_coach", "assistant_coach"].includes(data.role)) return null;
  return data as { id: string; club_id: string; first_name: string; last_name: string; role: ClubStaffRole; created_at: string };
}

export async function canViewAssignedPackage(packageId: string, memberId: string) {
  const { data, error } = await supabaseAdmin().from("event_package_assignments").select("id")
    .eq("package_id", packageId).eq("member_id", memberId).maybeSingle();
  return !error && !!data;
}
