import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(file, imports) {
  const source = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const exported = {};
  new Function("require", "exports", source)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, exported);
  return exported;
}
const packageId = "00000000-0000-0000-0000-000000000001";
const memberId = "00000000-0000-0000-0000-000000000002";
let allowed = true, fail = false, assigned = false, calls = 0;
const db = { from(table) {
  calls++;
  const filters = {};
  const query = {
    select() { return query; },
    eq(key, value) { filters[key] = value; return query; },
    async maybeSingle() {
      if (fail) return { error: { message: "Database failed" } };
      if (table === "club_staff") return { data: filters.id === memberId ? { id: memberId, role: "player" } : null };
      assert.equal(table, "event_package_assignments");
      return { data: assigned && filters.package_id === packageId && filters.member_id === memberId ? { id: "assignment" } : null };
    },
    upsert(rows, options) {
      assert.equal(options.onConflict, "package_id,member_id");
      assert.equal(options.ignoreDuplicates, true);
      assert.deepEqual(rows, [{ package_id: packageId, member_id: memberId }]);
      return { select: async () => {
        if (fail) return { error: { message: "Database failed" } };
        const data = assigned ? [] : [{ member_id: memberId }]; assigned = true;
        return { data };
      } };
    },
    delete() { return query; },
    then(resolve, reject) {
      assert.deepEqual(filters, { package_id: packageId, member_id: memberId });
      if (!fail) assigned = false;
      return Promise.resolve({ error: fail ? { message: "Database failed" } : null }).then(resolve, reject);
    },
  }; return query;
} };
const actions = load("app/admin/package-assignment-actions.ts", {
  "@/lib/club-event-access": { requireSuperadmin: async () => { if (!allowed) throw Error("Denied"); } },
  "@/lib/supabase/server": { supabaseAdmin: () => db }, "next/cache": { revalidatePath() {} },
});
let session = { role: "club_staff", staffId: memberId };
const access = load("lib/package-recipient-access.ts", {
  "server-only": {}, "next/headers": { cookies: async () => ({ get: () => ({ value: "session" }) }) },
  "@/lib/auth": { SESSION_COOKIE_NAME: "session", readSessionToken: async () => session },
  "@/lib/supabase/server": { supabaseAdmin: () => db },
});
assert.equal((await access.getPackageRecipient()).id, memberId);
assert.equal(await access.canViewAssignedPackage(packageId, memberId), false);
assert.equal((await actions.assignPackage(packageId, [memberId, memberId])).added, 1);
assert.equal((await actions.assignPackage(packageId, [memberId])).added, 0);
assert.equal(await access.canViewAssignedPackage(packageId, memberId), true);
assert.equal(await access.canViewAssignedPackage(packageId, "another-member"), false);
assert.equal(await access.canViewAssignedPackage("another-package", memberId), false);
await actions.unassignPackage(packageId, memberId);
assert.equal(await access.canViewAssignedPackage(packageId, memberId), false);
assert.ok((await actions.assignPackage(packageId, [])).error);
assert.ok((await actions.assignPackage(packageId, ["bad-id"])).error);
fail = true;
assert.ok((await actions.assignPackage(packageId, [memberId])).error);
assert.equal(await access.canViewAssignedPackage(packageId, memberId), false);
assert.equal(await access.getPackageRecipient(), null);
allowed = false;
const before = calls;
await assert.rejects(actions.assignPackage(packageId, [memberId]), /Denied/);
await assert.rejects(actions.unassignPackage(packageId, memberId), /Denied/);
await assert.rejects(actions.loadPackageRecipients(packageId), /Denied/);
assert.equal(calls, before);
session = null;
assert.equal(await access.getPackageRecipient(), null);
console.log("PASS: assignment authorization, duplicates, revocation, recipient isolation, validation and failure handling");
