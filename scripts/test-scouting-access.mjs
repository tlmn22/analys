import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/scouting-access.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
let editor = null, season = '', failed = false, reads = 0;
const mod = { exports: {} };
new Function('require', 'module', 'exports', outputText)(name => {
  if (name === 'server-only') return {};
  if (name === '@/lib/club-event-access') return { getEventEditor: async () => editor };
  if (name === '@/lib/supabase/server') return { supabaseAdmin: () => ({ from(table) {
    assert.equal(table, 'games'); reads++;
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: season ? { season_id: season } : null, error: failed ? {} : null }) };
    return query;
  } }) };
  throw new Error(name);
}, mod, mod.exports);
const { reportAccess, SCOUTING_SEASON_IDS } = mod.exports;
assert.equal(await reportAccess('game'), null);
assert.equal(reads, 0);
for (const staffRole of ['owner', 'manager', 'head_coach', 'assistant_coach']) {
  editor = { role: 'club_staff', staffRole, clubId: 'club' };
  for (const id of SCOUTING_SEASON_IDS) { season = id; assert.deepEqual(await reportAccess('game'), editor); }
  season = 'unlisted'; assert.equal(await reportAccess('game'), null);
  season = ''; assert.equal(await reportAccess('game'), null);
  season = SCOUTING_SEASON_IDS[0]; failed = true; assert.equal(await reportAccess('game'), null); failed = false;
}
editor = { role: 'superadmin' }; season = 'unlisted';
assert.deepEqual(await reportAccess('game'), editor);
console.log('PASS: report season allowlist, staff roles, unauthorized/missing games and database failure');
