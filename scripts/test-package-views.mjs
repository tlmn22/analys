import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path, deps = {}) {
  const mod = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  new Function('require', 'module', 'exports', outputText)(name => { if (!(name in deps)) throw Error(name); return deps[name]; }, mod, mod.exports);
  return mod.exports;
}
const { addPlaybackInterval } = load('lib/playback-coverage.ts');
let intervals = addPlaybackInterval([], 0, 4);
intervals = addPlaybackInterval(intervals, 2, 6);
intervals = addPlaybackInterval(intervals, 9, 10);
assert.deepEqual(intervals, [[0, 6], [9, 10]]);
assert.deepEqual(addPlaybackInterval(intervals, 12, 10), intervals);

let editor = null, fail = false, reads = 0;
const members = [
  { id: 'a', member: { id: 'p1', first_name: 'One', role: 'player', club_id: 'club-a' } },
  { id: 'b', member: { id: 'p2', first_name: 'Two', role: 'player', club_id: 'club-b' } },
];
const views = Array.from({ length: 501 }, (_, i) => ({ assignment_id: 'a', item_id: 'item', completed: i !== 0, updated_at: '2026-10-01T01:00:00Z' }));
views.push({ assignment_id: 'b', item_id: 'item', completed: true, updated_at: '2026-10-01T02:00:00Z' });
const db = { from(table) {
  reads++;
  let club, ids;
  const q = {
    select: () => q,
    eq(field, value) { if (field === 'member.club_id') club = value; return q; },
    in(field, value) { assert.equal(field, 'assignment_id'); ids = value; return q; },
    order: () => q,
    async range(start, end) {
      if (fail && table === 'event_package_views') return { error: {} };
      const data = table === 'event_package_assignments' ? members.filter(m => !club || m.member.club_id === club) : table === 'event_package_items' ? [{ id: 'item', event: null }] : views.filter(v => ids.includes(v.assignment_id));
      return { data: data.slice(start, end + 1) };
    },
  }; return q;
} };
const { loadPackageViewReport } = load('app/package-view-report.ts', {
  '@/lib/club-event-access': { getEventEditor: async () => editor },
  '@/lib/supabase/server': { supabaseAdmin: () => db },
});
const id = '5af1965b-8fc9-4623-ba68-055f9c633ffc';
assert.ok((await loadPackageViewReport(id)).error); assert.equal(reads, 0);
for (const staffRole of ['owner', 'manager', 'head_coach', 'assistant_coach']) {
  editor = { role: 'club_staff', clubId: 'club-a', staffRole };
  const { data } = await loadPackageViewReport(id);
  assert.deepEqual(data.members.map(m => m.id), ['p1']);
  assert.equal(data.progress.length, 1);
  assert.equal(data.progress[0].count, 500);
}
editor = { role: 'club_staff', clubId: 'unassigned' };
assert.ok((await loadPackageViewReport(id)).error);
editor = { role: 'superadmin' };
assert.equal((await loadPackageViewReport(id)).data.members.length, 2);
fail = true;
assert.ok((await loadPackageViewReport(id)).error);
console.log('PASS: playback coverage avoids seek gaps/duplicates; view report pagination, club isolation, roles and errors');
