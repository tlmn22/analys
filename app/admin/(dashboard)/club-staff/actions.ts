"use server";

import { requireSuperadmin } from "@/lib/club-event-access";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/password";
import type { ClubStaffRole } from "@/lib/types";

export type ActionState = { error?: string; success?: boolean };

const VALID_ROLES: ClubStaffRole[] = [
  "owner",
  "manager",
  "head_coach",
  "assistant_coach",
  "player",
];

function parseClubStaffInput(formData: FormData) {
  const clubId = String(formData.get("club_id") || "").trim();
  const firstName = String(formData.get("first_name") || "").trim();
  const lastName = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");

  if (!clubId) return { error: "Клуб сонгоно уу" as const };
  if (!firstName) return { error: "Нэрээ оруулна уу" as const };
  if (!lastName) return { error: "Овгоо оруулна уу" as const };
  if (!email || !email.includes("@")) return { error: "Зөв email хаяг оруулна уу" as const };
  if (!VALID_ROLES.includes(role as ClubStaffRole)) return { error: "Эрх сонгоно уу" as const };

  return { clubId, firstName, lastName, email, role: role as ClubStaffRole };
}

export async function createClubStaff(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubStaffInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Нууц үг доод тал нь 8 тэмдэгттэй байна" };

  const password_hash = await hashPassword(password);

  const { error } = await supabaseAdmin().from("club_staff").insert({
    club_id: parsed.clubId,
    first_name: parsed.firstName,
    last_name: parsed.lastName,
    email: parsed.email,
    role: parsed.role,
    password_hash,
  });

  if (error) {
    if (error.code === "23505") return { error: "Энэ email хаяг бүртгэлтэй байна" };
    return { error: error.message };
  }

  revalidatePath("/admin/club-staff");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateClubStaff(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperadmin();
  const parsed = parseClubStaffInput(formData);
  if ("error" in parsed) return { error: parsed.error };

  const update: Record<string, unknown> = {
    club_id: parsed.clubId,
    first_name: parsed.firstName,
    last_name: parsed.lastName,
    email: parsed.email,
    role: parsed.role,
  };

  const password = String(formData.get("password") || "");
  if (password.length > 0) {
    if (password.length < 8) return { error: "Нууц үг доод тал нь 8 тэмдэгттэй байна" };
    update.password_hash = await hashPassword(password);
  }

  const { error } = await supabaseAdmin().from("club_staff").update(update).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Энэ email хаяг бүртгэлтэй байна" };
    return { error: error.message };
  }

  revalidatePath("/admin/club-staff");
  return { success: true };
}

export async function deleteClubStaff(id: string) {
  await requireSuperadmin();
  await supabaseAdmin().from("club_staff").delete().eq("id", id);
  revalidatePath("/admin/club-staff");
  revalidatePath("/admin");
}
