// Run with: node --test scripts/test-club-event-access.mjs
// Exercises production actions with an isolated database; never touches live data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function load(file, imports) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  const loadedModule = { exports: {} };
  const require = (name) => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  };
  new Function("require", "module", "exports", outputText)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

function setup(role = "manager", clubId = "club-a") {
  const people = [
    { id: "editor", role, club_id: clubId },
    { id: "player-a", role: "player", club_id: "club-a" },
    { id: "player-b", role: "player", club_id: "club-b" },
  ];
  const event = { id: "event-a", club_id: "club-a", description: "Original" };
  const writes = [];
  const invalidated = [];
  const state = { role, failStaffRead: false, failWrite: false, people };
  const db = {
    from(table) {
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        result() {
          if (table === "club_staff" && state.failStaffRead) return { data: null, error: { message: "Read failed" } };
          const data = (table === "club_events" ? [event] : people).filter((r) => filters.every(([k, v]) => r[k] === v));
          return { data, error: null };
        },
        async maybeSingle() { const r = query.result(); return { ...r, data: r.data?.[0] ?? null }; },
        then(resolve, reject) { return Promise.resolve(query.result()).then(resolve, reject); },
        async upsert(rows) {
          if (state.failWrite) return { error: { message: "Write failed" } };
          writes.push({ table, rows });
          return { error: null };
        },
        update(values) {
          const update = {
            eq(key, value) { filters.push([key, value]); return update; },
            then(resolve, reject) {
              if (state.failWrite) return Promise.resolve({ error: { message: "Write failed" } }).then(resolve, reject);
              writes.push({ table, values, filters });
              return Promise.resolve({ error: null }).then(resolve, reject);
            },
          };
          return update;
        },
      };
      return query;
    },
  };
  const access = load("lib/club-event-access.ts", {
    "server-only": {},
    "next/headers": { cookies: async () => ({ get: () => state.role ? { value: "test-token" } : undefined }) },
    "@/lib/auth": {
      SESSION_COOKIE_NAME: "admin_session",
      readSessionToken: async () => state.role === "superadmin" ? { role: "superadmin" } : { role: "club_staff", staffId: "editor" },
    },
    "@/lib/supabase/server": { supabaseAdmin: () => db },
  });
  const actions = load("app/admin/(dashboard)/club-events/[eventId]/attendance/actions.ts", {
    "next/cache": { revalidatePath: (path) => invalidated.push(path) },
    "@/lib/supabase/server": { supabaseAdmin: () => db },
    "@/lib/club-event-access": access,
  });
  return { ...actions, ...access, writes, invalidated, state };
}

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("staff page scopes both queries to the current club and rejects unauthenticated users", async () => {
  for (const role of [null, "player", "owner", "manager", "head_coach", "assistant_coach", "superadmin"]) {
    const access = setup(role);
    const queries = [];
    const page = load("app/admin/(dashboard)/club-staff/page.tsx", {
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
      "@/lib/club-event-access": access,
      "next/navigation": { redirect: () => { throw new Error("LOGIN_REQUIRED"); } },
      "@/lib/supabase/server": { supabaseAdmin: () => ({ from(table) {
        const record = { table, filters: [] }; queries.push(record);
        const query = {
          select(columns) { assert.ok(!columns.includes("password")); return query; },
          order() { return query; },
          eq(key, value) { record.filters.push([key, value]); return query; },
          returns() { return Promise.resolve({ data: [], error: null }); },
        }; return query;
      } }) },
      "@/components/ui/table": {}, "@/components/ui/button": {}, "@/components/ui/badge": {},
      "@/components/admin/club-staff-form-dialog": {}, "@/components/admin/delete-button": {},
      "./actions": {}, "lucide-react": {},
    });
    if (!role || role === "player") {
      await assert.rejects(page.default(), /LOGIN_REQUIRED/);
      assert.equal(queries.length, 0);
    } else {
      await page.default();
      assert.deepEqual(queries, [
        { table: "club_staff", filters: role === "superadmin" ? [] : [["club_id", "club-a"]] },
        { table: "clubs", filters: role === "superadmin" ? [] : [["id", "club-a"]] },
      ]);
    }
  }
});

test("proxy restricts club staff to the four permitted sections", async () => {
  for (const role of ["superadmin", "club_staff"]) {
    const { proxy } = load("proxy.ts", {
      "next/server": { NextResponse: { next: () => "allowed", redirect: () => "redirected" } },
      "@/lib/auth": { SESSION_COOKIE_NAME: "admin_session", readSessionToken: async () => ({ role }) },
    });
    for (const path of ["/admin", "/admin/teams", "/admin/players", "/admin/seasons", "/admin/clubs", "/admin/tag/game", "/admin/club-staff/invalid"]) {
      assert.equal(await proxy({ nextUrl: new URL(`https://example.com${path}`), url: `https://example.com${path}`, cookies: { get: () => ({ value: "token" }) } }), role === "superadmin" ? "allowed" : "redirected");
    }
    for (const path of ["/admin/club-staff", "/admin/club-events", "/admin/club-events/event-a/attendance", "/admin/club-reports", "/admin/club-load-monitoring"]) {
      assert.equal(await proxy({ nextUrl: new URL(`https://example.com${path}`), url: `https://example.com${path}`, cookies: { get: () => ({ value: "token" }) } }), "allowed");
    }
  }
});

for (const role of ["superadmin", "owner", "manager", "head_coach", "assistant_coach"]) {
  test(`${role} can mark player attendance in their club`, async () => {
    const h = setup(role);
    for (const status of ["present", "absent", "late", "excused", "sick"]) {
      assert.equal((await h.saveAttendance("event-a", {}, form({ "status__player-a": status }))).success, true);
      assert.equal(h.writes.at(-1).rows[0].status, status);
    }
    assert.ok(h.invalidated.includes("/admin/club-events/event-a/attendance"));
  });
}

for (const role of [null, "player"]) {
  test(`${role ?? "anonymous"} cannot update attendance, description or admin data`, async () => {
    const h = setup(role);
    assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "late" }))).error);
    assert.ok((await h.saveEventDescription("event-a", {}, form({ description: "Changed" }))).error);
    await assert.rejects(h.requireSuperadmin);
    assert.equal(h.writes.length, 0);
  });
}

test("staff cannot access another club's event or privileged admin actions", async () => {
  const h = setup("manager", "club-b");
  assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "late" }))).error);
  assert.ok((await h.saveEventDescription("event-a", {}, form({ description: "Changed" }))).error);
  await assert.rejects(h.requireSuperadmin);
  assert.equal(h.writes.length, 0);
});

test("unknown events and cross-club attendance members are rejected before any write", async () => {
  const h = setup();
  assert.ok((await h.saveAttendance("missing", {}, form({ "status__player-a": "late" }))).error);
  assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "late", "status__player-b": "absent" }))).error);
  assert.equal(h.writes.length, 0);
});

test("invalid and duplicate statuses reject the whole submission", async () => {
  const h = setup();
  assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "invalid" }))).error);
  const duplicate = form({ "status__player-a": "late" });
  duplicate.append("status__player-a", "absent");
  assert.ok((await h.saveAttendance("event-a", {}, duplicate)).error);
  assert.equal(h.writes.length, 0);
});

test("unmarked members are not marked absent when another member is saved", async () => {
  const h = setup();
  assert.equal((await h.saveAttendance("event-a", {}, form({ status__editor: "", "status__player-a": "present" }))).success, true);
  assert.equal(h.writes[0].rows.length, 1);
  assert.equal(h.writes[0].rows[0].club_staff_id, "player-a");
  assert.ok((await h.saveAttendance("event-a", {}, form({ status__editor: "" }))).error);
});

test("description can be updated and cleared independently of attendance", async () => {
  const h = setup();
  assert.equal((await h.saveEventDescription("event-a", {}, form({ description: "  Practice notes  " }))).success, true);
  assert.deepEqual(h.writes[0].values, { description: "Practice notes" });
  assert.equal((await h.saveEventDescription("event-a", {}, form({ description: "  " }))).success, true);
  assert.deepEqual(h.writes[1].values, { description: null });
  assert.ok(h.writes.every((w) => w.table === "club_events"));
});

test("role changes revoke access on the next request", async () => {
  const h = setup();
  assert.ok(await h.getEventEditor());
  h.state.people[0].role = "player";
  assert.equal(await h.getEventEditor(), null);
  assert.ok((await h.saveEventDescription("event-a", {}, form({ description: "Changed" }))).error);
  assert.equal(h.writes.length, 0);
});

test("database errors are not reported as successful saves", async () => {
  const h = setup("superadmin");
  h.state.failStaffRead = true;
  assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "late" }))).error);
  h.state.failStaffRead = false;
  h.state.failWrite = true;
  assert.ok((await h.saveAttendance("event-a", {}, form({ "status__player-a": "late" }))).error);
  assert.ok((await h.saveEventDescription("event-a", {}, form({ description: "Changed" }))).error);
  assert.equal(h.writes.length, 0);
});

test("staff login permits editor roles, rejects player/incorrect credentials and issues no rejected session", async () => {
  for (const role of ["owner", "manager", "head_coach", "assistant_coach", "player"]) {
    const issued = [];
    const query = {
      select() { return query; },
      eq(key, value) { assert.equal(key, "email"); assert.equal(value, "staff@example.com"); return query; },
      async maybeSingle() { return { data: { id: "staff-id", role, password_hash: "test-hash" }, error: null }; },
    };
    const { login } = load("app/admin/login/actions.ts", {
      "next/headers": { cookies: async () => ({ set: (...args) => issued.push(args) }) },
      "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
      "@/lib/auth": { SESSION_COOKIE_NAME: "admin_session", createStaffSessionToken: async () => "staff-session" },
      "@/lib/supabase/server": { supabaseAdmin: () => ({ from: () => query }) },
      "@/lib/password": { verifyPassword: async (password) => password === "correct-password" },
    });
    assert.ok((await login({}, form({ email: " Staff@Example.com ", password: "wrong-password" }))).error);
    assert.equal(issued.length, 0);
    const credentials = form({ email: " Staff@Example.com ", password: "correct-password" });
    if (role === "player") {
      assert.ok((await login({}, credentials)).error);
      assert.equal(issued.length, 0);
    } else {
      await assert.rejects(() => login({}, credentials), /redirect:\/admin\/club-events/);
      assert.equal(issued.length, 1);
      assert.equal(issued[0][1], "staff-session");
      assert.equal(issued[0][2].httpOnly, true);
    }
  }
});

test("existing password-only superadmin login remains supported", async () => {
  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "test-admin-password";
  try {
    const issued = [];
    const { login } = load("app/admin/login/actions.ts", {
      "next/headers": { cookies: async () => ({ set: (...args) => issued.push(args) }) },
      "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
      "@/lib/auth": { SESSION_COOKIE_NAME: "admin_session", createSessionToken: async () => "admin-session" },
      "@/lib/supabase/server": { supabaseAdmin: () => { throw new Error("Admin login must not query staff"); } },
      "@/lib/password": {},
    });
    assert.ok((await login({}, form({ password: "wrong" }))).error);
    assert.equal(issued.length, 0);
    await assert.rejects(() => login({}, form({ password: "test-admin-password" })), /redirect:\/admin$/);
    assert.equal(issued[0][1], "admin-session");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  }
});
