"use server";

import { requireSuperadmin } from "@/lib/club-event-access";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { uploadImage } from "@/lib/storage";

export type ActionState = { error?: string; success?: boolean };

function parseClubInput(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const sponsorName = String(formData.get("sponsor_name") || "").trim();

  if (!name) return { error: "Клубын нэрээ оруулна уу" as const };

  return { name, sponsorName: sponsorName || null };
}

export async function createClub(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  let logo_url: string | null = null;
  let sponsor_logo_url: string | null = null;
  try {
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      logo_url = await uploadImage(logo, "clubs");
    }
    const sponsorLogo = formData.get("sponsor_logo");
    if (sponsorLogo instanceof File && sponsorLogo.size > 0) {
      sponsor_logo_url = await uploadImage(sponsorLogo, "clubs");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin().from("clubs").insert({
    name: parsed.name,
    sponsor_name: parsed.sponsorName,
    logo_url,
    sponsor_logo_url,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/clubs");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateClub(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const update: Record<string, unknown> = {
    name: parsed.name,
    sponsor_name: parsed.sponsorName,
  };

  try {
    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      update.logo_url = await uploadImage(logo, "clubs");
    }
    const sponsorLogo = formData.get("sponsor_logo");
    if (sponsorLogo instanceof File && sponsorLogo.size > 0) {
      update.sponsor_logo_url = await uploadImage(sponsorLogo, "clubs");
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Зураг хуулахад алдаа гарлаа" };
  }

  const { error } = await supabaseAdmin().from("clubs").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/clubs");
  return { success: true };
}

export async function deleteClub(id: string) {
  await requireSuperadmin();
  await supabaseAdmin().from("clubs").delete().eq("id", id);
  revalidatePath("/admin/clubs");
  revalidatePath("/admin");
}
