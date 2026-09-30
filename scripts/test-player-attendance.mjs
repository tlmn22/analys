import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exported = {};
  new Function("require", "exports", code)(name => imports[name], exported);
  return exported;
}
const member = { id: "me", club_id: "my-club", created_at: "2026-09-01T00:00:00Z" };
const now = Date.parse("2026-09-28T00:00:00Z");
let fail = false;
const seen = [];
const events = Array.from({ length: 501 }, (_, i) => ({ id: String(i), club_id: "my-club", start_at: "2026-09-20T00:00:00Z", end_at: "2026-09-20T02:00:00Z", event_type: "gym_prep" }));
const statuses = ["present", "late", "absent", "excused", "sick"];
const records = statuses.map((status, i) => ({ event_id: String(i), club_staff_id: "me", status }));
const db = { from(table) {
  const filters = {};
  const q = { select() { return q; }, eq(k, v) { filters[k] = v; return q; }, lte(k, v) { filters[k] = v; return q; }, order() { return q; }, async range(start, end) {
    seen.push({ table, filters, start });
    return fail ? { error: { message: "Failed" } } : { data: (table === "club_events" ? events : records).slice(start, end + 1) };
  } }; return q;
} };
const { getPlayerAttendance } = load("lib/player-attendance.ts", { "server-only": {}, "@/lib/supabase/server": { supabaseAdmin: () => db }, "@/lib/club-attendance-report": load("lib/club-attendance-report.ts") });
const result = await getPlayerAttendance(member, now);
assert.equal(result.total, 501);
assert.equal(result.marked, 5);
assert.equal(result.rate, 40);
assert.equal(result.counts.unmarked, 496);
assert.ok(seen.some(call => call.table === "club_events" && call.start === 500));
for (const call of seen) {
  if (call.table === "club_events") assert.deepEqual(call.filters, { club_id: "my-club", end_at: new Date(now).toISOString() });
  else assert.deepEqual(call.filters, { club_staff_id: "me", "event.club_id": "my-club", "event.end_at": new Date(now).toISOString() });
}
fail = true;
assert.ok((await getPlayerAttendance(member, now)).error);
console.log("PASS: own-member and club scopes, completed cutoff, pagination, attendance rate and load errors");
