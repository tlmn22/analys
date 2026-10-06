import { getEventEditor } from "@/lib/club-event-access";
import { parseActivityBatch } from "@/lib/report-activity";
import { reportAccess } from "@/lib/scouting-access";
import { supabaseAdmin } from "@/lib/supabase/server";

// Receives batched report views/clicks (fetch keepalive or sendBeacon from
// report-activity-tracker). Lives outside /admin, so it checks the session itself.
export async function POST(request: Request) {
  const editor = await getEventEditor();
  if (!editor) return new Response(null, { status: 401 });
  // Superadmin browsing is not logged.
  if (editor.role !== "club_staff") return new Response(null, { status: 204 });

  const text = await request.text();
  if (text.length > 64_000) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const rows = parseActivityBatch(body, Date.now());
  if (!rows) return new Response(null, { status: 400 });
  if (!(await reportAccess(rows[0].game_id))) return new Response(null, { status: 403 });

  const { error } = await supabaseAdmin()
    .from("report_activity")
    .insert(rows.map((row) => ({ ...row, staff_id: editor.staffId })));
  if (error) return new Response(null, { status: 500 });
  return new Response(null, { status: 204 });
}
