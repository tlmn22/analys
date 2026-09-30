import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../app/admin/event-package-actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let allowed = true, failure = false, calls = 0;
const items = new Set();
const id = "00000000-0000-0000-0000-000000000001";
const db = {
  from(table) {
    calls++;
    return {
      insert(values) { assert.deepEqual(values, { name: "Scout", description: "notes" }); return { select: () => ({ single: async () => failure ? { error: { message: "DB failure" } } : { data: { id } } }) }; },
      select: () => ({ order: async () => ({ data: [{ id, name: "Scout", description: "" }], error: failure ? { message: "DB failure" } : null }) }),
      upsert: (row, options) => ({ select: () => ({ then(resolve, reject) {
        assert.ok(Array.isArray(row));
        assert.equal(options.ignoreDuplicates, true);
        if (failure) return Promise.resolve({ error: { message: "DB failure" } }).then(resolve, reject);
        const added = [];
        for (const entry of row) {
          const key = `${entry.package_id}:${entry.event_id}`;
          if (!items.has(key)) added.push({ id: entry.event_id });
          items.add(key);
        }
        return Promise.resolve({ data: added, error: null }).then(resolve, reject);
      }, maybeSingle: async () => {
        assert.equal(table, "event_package_items");
        assert.equal(options.ignoreDuplicates, true);
        assert.equal(options.onConflict, "package_id,event_id");
        if (failure) return { error: { message: "DB failure" } };
        const key = `${row.package_id}:${row.event_id}`;
        const exists = items.has(key); items.add(key);
        return { data: exists ? null : { id }, error: null };
      } }) }),
    };
  },
  async rpc(name, args) {
    calls++;
    assert.ok(["create_event_package_with_event", "create_event_package_with_events"].includes(name));
    assert.equal(args.package_name, "Scout");
    if (name.endsWith("_events")) assert.deepEqual(args.selected_event_ids, [id]);
    else assert.equal(args.selected_event_id, id);
    return failure ? { error: { message: "Missing event" } } : { data: id, error: null };
  },
};
const exported = {};
new Function("require", "exports", compiled)(name => {
  if (name === "@/lib/club-event-access") return { requireSuperadmin: async () => { if (!allowed) throw Error("Unauthorized"); } };
  if (name === "@/lib/supabase/server") return { supabaseAdmin: () => db };
  throw Error(name);
}, exported);
assert.equal((await exported.listEventPackages()).packages[0].id, id);
assert.equal((await exported.createEventPackage(" Scout ", "notes", id)).id, id);
assert.equal((await exported.addEventToPackage(id, id)).alreadyAdded, false);
assert.equal((await exported.addEventToPackage(id, id)).alreadyAdded, true);
assert.equal(items.size, 1);
const before = calls;
assert.ok((await exported.createEventPackage(" ", "", id)).error);
assert.ok((await exported.createEventPackage("Scout", "x".repeat(2001), id)).error);
assert.ok((await exported.addEventToPackage("invalid", id)).error);
assert.equal(calls, before);
failure = true;
assert.ok((await exported.listEventPackages()).error);
assert.ok((await exported.createEventPackage("Scout", "", id)).error);
assert.ok((await exported.addEventToPackage(id, id)).error);
allowed = false;
const blocked = calls;
await assert.rejects(exported.listEventPackages(), /Unauthorized/);
await assert.rejects(exported.createEventPackage("Scout", "", id), /Unauthorized/);
await assert.rejects(exported.addEventToPackage(id, id), /Unauthorized/);
assert.equal(calls, blocked);
console.log("PASS: package authorization, validation, atomic-create RPC, duplicate suppression and database failures");

allowed = true; failure = false;
const secondId = "00000000-0000-0000-0000-000000000002";
assert.deepEqual(await exported.addEventsToPackage(id, [id, secondId, secondId]), { success: true, added: 1, skipped: 1 });
assert.deepEqual(await exported.addEventsToPackage(id, [id, secondId]), { success: true, added: 0, skipped: 2 });
assert.equal((await exported.createEventPackageWithEvents("Scout", "", [id, id])).added, 1);
const validated = calls;
for (const invalid of [[], ["bad"], Array(1001).fill(id)]) {
  assert.ok((await exported.addEventsToPackage(id, invalid)).error);
  assert.ok((await exported.createEventPackageWithEvents("Scout", "", invalid)).error);
}
assert.equal(calls, validated);
failure = true;
assert.ok((await exported.addEventsToPackage(id, [id])).error);
assert.ok((await exported.createEventPackageWithEvents("Scout", "", [id])).error);
allowed = false;
await assert.rejects(exported.addEventsToPackage(id, [id]), /Unauthorized/);
await assert.rejects(exported.createEventPackageWithEvents("Scout", "", [id]), /Unauthorized/);
console.log("PASS: bulk duplicate handling, unique counts, input bounds, create RPC and access checks");
allowed = true; failure = false;
assert.equal((await exported.createEmptyEventPackage(" Scout ", " notes ")).id, id);
assert.ok((await exported.createEmptyEventPackage(" ", "")).error);
assert.ok((await exported.createEmptyEventPackage("Scout", "x".repeat(2001))).error);
failure = true;
assert.ok((await exported.createEmptyEventPackage("Scout", "notes")).error);
allowed = false;
await assert.rejects(exported.createEmptyEventPackage("Scout", "notes"), /Unauthorized/);
console.log("PASS: empty package creation, validation, authorization and failure handling");
