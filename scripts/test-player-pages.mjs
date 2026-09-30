import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const calendar = {};
new Function("exports", ts.transpileModule(readFileSync(new URL("../lib/club-event-calendar.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(calendar);

for (const file of ["app/player/page.tsx", "app/player/schedule/page.tsx"]) {
  for (const authenticated of [true, false]) {
    const calls = [];
    const db = { from(table) {
      const call = { table, filters: {} }; calls.push(call);
      const query = {
        select(columns) { assert.ok(!columns.includes("password")); return query; },
        eq(key, value) { call.filters[key] = value; return query; },
        gt(key, value) { call.filters[key] = value; return query; },
        gte(key, value) { call.filters[key] = value; return query; },
        lt(key, value) { call.filters[key] = value; return query; },
        in(key, value) { call.filters[key] = value; return query; },
        order() { return query; }, limit() { return query; }, range() { return query; },
        then(resolve, reject) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject); },
      }; return query;
    } };
    const imports = {
      "next/link": { default: "link" },
      "next/navigation": { redirect: () => { throw Error("login-required"); } },
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
      "@/lib/package-recipient-access": { getPackageRecipient: async () => authenticated ? { id: "member-a", club_id: "club-a", first_name: "Player" } : null },
      "@/lib/supabase/server": { supabaseAdmin: () => db },
      "@/components/player/schedule-list": {},
      "@/components/player/training-calendar": {},
      "@/lib/club-event-calendar": calendar,
      "@/components/player/attendance-summary": {},
      "@/lib/player-attendance": { getPlayerAttendance: async member => { assert.equal(member.id, "member-a"); assert.equal(member.club_id, "club-a"); return {}; } },
    };
    const compiled = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exported = {};
    new Function("require", "exports", compiled)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, exported);
    if (!authenticated) {
      await assert.rejects(exported.default({ searchParams: Promise.resolve({}) }), /login-required/);
      assert.equal(calls.length, 0);
    } else {
      await exported.default({ searchParams: Promise.resolve({ month: "2026-09" }) });
      const schedule = calls.find(call => call.table === "club_events");
      assert.equal(schedule.filters.club_id, "club-a");
      assert.ok(Number.isFinite(Date.parse(schedule.filters.end_at)));
      if (file.includes("schedule")) {
        assert.deepEqual(schedule.filters.event_type, ["gym_prep", "fitness_prep"]);
        assert.equal(schedule.filters.end_at, "2026-08-30T16:00:00.000Z");
        assert.equal(schedule.filters.start_at, "2026-10-11T16:00:00.000Z");
      }
      for (const assignments of calls.filter(call => call.table === "event_package_assignments")) {
        assert.equal(assignments.filters.member_id, "member-a");
      }
    }
  }
}
console.log("PASS: player home and schedule require login, scope schedules to club and packages to member");
