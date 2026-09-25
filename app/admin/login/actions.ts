"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, createStaffSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password");
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Нууц үгээ оруулна уу" };
  }
  let token: string;
  if (email) {
    const { data: staff, error } = await supabaseAdmin().from("club_staff")
      .select("id, role, password_hash").eq("email", email).maybeSingle();
    if (error || !staff || !(await verifyPassword(password, staff.password_hash))) {
      return { error: "Email эсвэл нууц үг буруу байна" };
    }
    if (!["owner", "manager", "head_coach", "assistant_coach"].includes(staff.role)) {
      return { error: "Тоглогч ирц, эвентийн тайлбар засах эрхгүй." };
    }
    token = await createStaffSessionToken(staff.id);
  } else {
    if (!process.env.ADMIN_PASSWORD) {
      return { error: "Серверт ADMIN_PASSWORD тохируулагдаагүй байна" };
    }
    if (password !== process.env.ADMIN_PASSWORD) {
      return { error: "Нууц үг буруу байна" };
    }
    token = await createSessionToken();
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(email ? "/admin/club-events" : "/admin");
}
