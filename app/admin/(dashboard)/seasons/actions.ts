"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { SeasonStatus } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

function parseSeasonInput(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const status = String(formData.get("status") || "");

  if (!name) return { error: "Улирлын нэрээ оруулна уу" as const };
  if (status !== "active" && status !== "inactive") {
    return { error: "Төлөв сонгоно уу" as const };
  }

  return { name, status: status as SeasonStatus };
}

export async function createSeason(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseSeasonInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin().from("seasons").insert(parsed);
  if (error) return { error: error.message };

  revalidatePath("/admin/seasons");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateSeason(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseSeasonInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabaseAdmin().from("seasons").update(parsed).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/seasons");
  return { success: true };
}

export async function deleteSeason(id: string) {
  await supabaseAdmin().from("seasons").delete().eq("id", id);
  revalidatePath("/admin/seasons");
  revalidatePath("/admin");
}
