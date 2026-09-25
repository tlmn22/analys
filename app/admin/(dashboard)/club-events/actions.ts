"use server";

import { requireSuperadmin } from "@/lib/club-event-access";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ClubEventType } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const VALID_EVENT_TYPES: ClubEventType[] = ["gym_prep", "fitness_prep", "team_meeting", "other"];

function parseClubEventInput(formData: FormData) {
  const club_id = String(formData.get("club_id") || "");
  const name = String(formData.get("name") || "").trim();
  const event_type = String(formData.get("event_type") || "");
  const location = String(formData.get("location") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const start_raw = String(formData.get("start_at") || "");
  const end_raw = String(formData.get("end_at") || "");

  if (!club_id) return { error: "Клуб сонгоно уу" as const };
  if (!name) return { error: "Эвентийн нэрээ оруулна уу" as const };
  if (!VALID_EVENT_TYPES.includes(event_type as ClubEventType)) {
    return { error: "Эвентийн төрөл сонгоно уу" as const };
  }
  if (!start_raw) return { error: "Эхлэх огноог оруулна уу" as const };
  if (!end_raw) return { error: "Дуусах огноог оруулна уу" as const };

  const start_at = new Date(start_raw).toISOString();
  const end_at = new Date(end_raw).toISOString();
  if (end_at < start_at) return { error: "Дуусах огноо эхлэх огнооноос өмнө байж болохгүй" as const };

  return {
    club_id,
    name,
    event_type: event_type as ClubEventType,
    location,
    description,
    start_at,
    end_at,
  };
}

export async function createClubEvent(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubEventInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin().from("club_events").insert(parsed);
  if (error) return { error: error.message };

  revalidatePath("/admin/club-events");
  return { success: true };
}

export async function updateClubEvent(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubEventInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin().from("club_events").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/club-events");
  revalidatePath(`/admin/club-events/${id}/attendance`);
  return { success: true };
}

export async function deleteClubEvent(id: string) {
  await requireSuperadmin();
  await supabaseAdmin().from("club_events").delete().eq("id", id);
  revalidatePath("/admin/club-events");
}
