import "server-only";
import { cookies } from "next/headers";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export type EventEditor = { role: "superadmin" } | { role: "club_staff"; clubId: string; staffId: string };

export async function getEventEditor(): Promise<EventEditor | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (!session) return null;
  if (session.role === "superadmin") return session;
  // Resolve the current club/role on every request, including after a transfer or role change.
  const { data, error } = await supabaseAdmin().from("club_staff")
    .select("id, club_id, role").eq("id", session.staffId).maybeSingle();
  if (error || !data || !["owner", "manager", "head_coach", "assistant_coach"].includes(data.role)) return null;
  return { role: "club_staff", clubId: data.club_id, staffId: data.id };
}

export async function requireSuperadmin(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token) : null;
  if (session?.role !== "superadmin") throw new Error("Энэ үйлдлийг хийх эрхгүй байна.");
}
