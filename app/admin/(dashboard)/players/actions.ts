"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";
import type { PlayerPosition } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const VALID_POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"];

function parsePlayerInput(formData: FormData) {
  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const position = String(formData.get("position") || "");
  const active = formData.get("active") === "on";

  if (!first_name) return { error: "Тоглогчийн нэрээ оруулна уу" as const };
  if (!last_name) return { error: "Тоглогчийн овгийг оруулна уу" as const };
  if (!VALID_POSITIONS.includes(position as PlayerPosition)) {
    return { error: "Position сонгоно уу" as const };
  }

  return {
    first_name,
    last_name,
    position: position as PlayerPosition,
    active,
  };
}

export async function createPlayer(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parsePlayerInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  let photo_url: string | null = null;
  const photo = formData.get("photo");
  try {
    if (photo instanceof File && photo.size > 0) {
      photo_url = await uploadImage(photo, "players");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin()
    .from("players")
    .insert({ ...parsed, photo_url });

  if (error) return { error: error.message };

  revalidatePath("/admin/players");
  revalidatePath("/admin");
  return { success: true };
}

export async function updatePlayer(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parsePlayerInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const update: Record<string, unknown> = { ...parsed };

  const photo = formData.get("photo");
  try {
    if (photo instanceof File && photo.size > 0) {
      update.photo_url = await uploadImage(photo, "players");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin().from("players").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/players");
  return { success: true };
}

export async function deletePlayer(id: string) {
  await supabaseAdmin().from("players").delete().eq("id", id);
  revalidatePath("/admin/players");
  revalidatePath("/admin");
}
