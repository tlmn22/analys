import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "images";

export async function uploadImage(
  file: File,
  folder: "teams" | "players" | "clubs"
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(`Зураг хуулахад алдаа гарлаа: ${error.message}`);
  }

  const { data } = supabaseAdmin().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
