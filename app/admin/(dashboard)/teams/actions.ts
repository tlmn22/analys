"use server";

import { requireSuperadmin } from "@/lib/club-event-access";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";
import type { Gender } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

function parseTeamInput(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const gender = String(formData.get("gender") || "");

  if (!name) return { error: "Багийн нэрээ оруулна уу" as const };
  if (gender !== "male" && gender !== "female") {
    return { error: "Хүйс сонгоно уу" as const };
  }

  return { name, gender: gender as Gender };
}

export async function createTeam(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseTeamInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  let logo_url: string | null = null;
  const logo = formData.get("logo");
  try {
    if (logo instanceof File && logo.size > 0) {
      logo_url = await uploadImage(logo, "teams");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin()
    .from("teams")
    .insert({ name: parsed.name, gender: parsed.gender, logo_url });

  if (error) return { error: error.message };

  revalidatePath("/admin/teams");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateTeam(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseTeamInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const update: Record<string, unknown> = {
    name: parsed.name,
    gender: parsed.gender,
  };

  const logo = formData.get("logo");
  try {
    if (logo instanceof File && logo.size > 0) {
      update.logo_url = await uploadImage(logo, "teams");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin().from("teams").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/teams");
  return { success: true };
}

export async function deleteTeam(id: string) {
  await requireSuperadmin();
  await supabaseAdmin().from("teams").delete().eq("id", id);
  revalidatePath("/admin/teams");
  revalidatePath("/admin");
}
