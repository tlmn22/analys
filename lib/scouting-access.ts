import "server-only";
import { getEventEditor } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const SCOUTING_SEASON_IDS = [
  "b0254c58-46c3-468c-a502-8c940c8b29ed",
  "ec947bce-d335-4781-8caa-9f71b3d5303c",
];

export async function reportAccess(gameId: string) {
  const editor = await getEventEditor();
  if (!editor) return null;
  if (editor.role === "superadmin") return editor;
  const { data, error } = await supabaseAdmin().from("games")
    .select("season_id").eq("id", gameId).maybeSingle();
  return !error && data && SCOUTING_SEASON_IDS.includes(data.season_id) ? editor : null;
}
