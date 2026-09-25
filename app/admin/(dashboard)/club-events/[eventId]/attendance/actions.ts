"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/types";
import { getEventEditor } from "@/lib/club-event-access";

export type ActionState = { error?: string; success?: boolean };

const VALID_STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused", "sick"];

async function editableEvent(eventId: string) {
  const editor = await getEventEditor();
  if (!editor) return { error: "Ирц, тайлбар засах эрхгүй байна." };
  const { data, error } = await supabaseAdmin().from("club_events")
    .select("id, club_id").eq("id", eventId).maybeSingle();
  if (error) return { error: error.message };
  if (!data || (editor.role !== "superadmin" && editor.clubId !== data.club_id)) {
    return { error: "Эвент олдсонгүй эсвэл хандах эрхгүй байна." };
  }
  return { event: data };
}

/** One <select name={`status__<club_staff_id>`}> per staff row — parsed
 * back out here and upserted in bulk. */
export async function saveAttendance(
  eventId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await editableEvent(eventId);
  if (!access.event) return { error: access.error };
  const db = supabaseAdmin();
  const { data: staff, error: staffError } = await db.from("club_staff")
    .select("id").eq("club_id", access.event.club_id);
  if (staffError) return { error: staffError.message };
  const allowedIds = new Set((staff ?? []).map((s) => s.id));
  const seen = new Set<string>();
  const rows = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status__")) continue;
    const staffId = key.slice("status__".length);
    if (!allowedIds.has(staffId) || seen.has(staffId)) return { error: "Ирцийн жагсаалт өөрчлөгдсөн байна. Хуудсаа шинэчилнэ үү." };
    seen.add(staffId);
    if (value === "") continue; // Unmarked members are not silently recorded as absent.
    if (typeof value !== "string" || !VALID_STATUSES.includes(value as AttendanceStatus)) {
      return { error: "Ирцийн төлөв буруу байна." };
    }
    rows.push({ event_id: eventId, club_staff_id: staffId, status: value as AttendanceStatus, updated_at: new Date().toISOString() });
  }

  if (rows.length === 0) return { error: "Дор хаяж нэг хүний ирцийг сонгоно уу." };

  const { error } = await db
    .from("club_event_attendance")
    .upsert(rows, { onConflict: "event_id,club_staff_id" });

  if (error) return { error: error.message };

  revalidatePath(`/admin/club-events/${eventId}/attendance`);
  return { success: true };
}

export async function saveEventDescription(
  eventId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await editableEvent(eventId);
  if (!access.event) return { error: access.error };
  const value = formData.get("description");
  if (typeof value !== "string") return { error: "Тайлбарын утга буруу байна." };
  const { error } = await supabaseAdmin().from("club_events")
    .update({ description: value.trim() || null }).eq("id", eventId).eq("club_id", access.event.club_id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/club-events/${eventId}/attendance`);
  revalidatePath("/admin/club-events");
  return { success: true };
}
