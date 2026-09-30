import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/club-package-access.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i), package_id: i === 500 ? 'second' : 'first', club: 'a' }));
rows.push({ id: 'other', package_id: 'private', club: 'b' });
let fail = false;
const db = { from(table) {
  assert.equal(table, 'event_package_assignments');
  let club;
  const query = {
    select(value) { assert.ok(value.includes('!inner')); return query; },
    eq(field, value) { assert.equal(field, 'member.club_id'); club = value; return query; },
    order() { return query; },
    async range(start, end) { return fail ? { error: { message: 'failed' } } : { data: rows.filter(r => r.club === club).slice(start, end + 1) }; },
  };
  return query;
} };
const mod = { exports: {} };
new Function('require', 'module', 'exports', outputText)(name => {
  if (name === 'server-only') return {};
  if (name === '@/lib/supabase/server') return { supabaseAdmin: () => db };
  throw new Error(name);
}, mod, mod.exports);
assert.deepEqual(await mod.exports.clubPackageIds('a'), ['first', 'second']);
assert.deepEqual(await mod.exports.clubPackageIds('b'), ['private']);
assert.deepEqual(await mod.exports.clubPackageIds('empty'), []);
fail = true;
await assert.rejects(mod.exports.clubPackageIds('a'));
console.log('PASS: club isolation, assignment pagination, deduplication, empty scope and query failure');
