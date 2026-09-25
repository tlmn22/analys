import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL('../lib/club-load-monitoring.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { buildLoadMonitoring: build, loadBand, weekMonday } = exports;
const member = { id: 'p', club_id: 'a', role: 'player', created_at: '2026-01-01T00:00:00Z' };
const event = (id, extra = {}) => ({ id, club_id: 'a', event_type: 'gym_prep', start_at: '2026-09-14T07:00:00+08:00', end_at: '2026-09-14T09:00:00+08:00', ...extra });
const entry = (event_id, status, club_staff_id = 'p') => ({ event_id, status, club_staff_id });
const now = Date.parse('2026-09-21T00:00:00+08:00');
test('threshold edges are unambiguous', () => {
  for (const [hours, expected] of [[0,'low'],[14.99,'low'],[15,'normal'],[20,'normal'],[20.01,'high'],[24,'high'],[24.01,'over']]) assert.equal(loadBand(hours), expected);
});
test('week selection handles Sundays and year boundaries', () => {
  assert.equal(weekMonday('2026-09-20'),'2026-09-14');
  assert.equal(weekMonday('2026-09-21'),'2026-09-21');
  assert.equal(weekMonday('2026-01-01'),'2025-12-29');
});
test('only training, same club, player participation counts; late uses scheduled duration', () => {
  const events = [event('a'), event('b'), event('meeting',{event_type:'team_meeting'}), event('other',{club_id:'b'}), event('sick'), event('excused'), event('absent')];
  const entries = [entry('a','present'),entry('b','late'),entry('meeting','present'),entry('other','present'),entry('sick','sick'),entry('excused','excused'),entry('absent','absent')];
  const result = build(events,[member,{...member,id:'coach',role:'head_coach'}],entries,'2026-09-14',now);
  assert.equal(result.players.length,1);
  assert.equal(result.players[0].hours,4);
  assert.equal(result.players[0].late,1);
  assert.equal(result.players[0].participated,2);
});
test('unmarked, no data, and unfinished weeks are not classified as low', () => {
  assert.equal(build([event('a')],[member],[],'2026-09-14',now).players[0].band,null);
  assert.equal(build([],[member],[],'2026-09-14',now).players[0].band,null);
  const result=build([event('a')],[member],[entry('a','present')],'2026-09-14',Date.parse('2026-09-15T00:00:00Z'));
  assert.equal(result.players[0].hours,2); assert.equal(result.players[0].band,null);
  assert.equal(build([event('a')],[member],[entry('a','absent')],'2026-09-14',now).players[0].band,'low');
});
test('week crossing is clipped, duplicate event ids do not double count, ongoing sessions excluded', () => {
  const cross=event('a',{start_at:'2026-09-13T23:00:00+08:00',end_at:'2026-09-14T01:00:00+08:00'});
  const result=build([cross,cross],[member],[entry('a','present')],'2026-09-14',now).players[0];
  assert.equal(result.hours,1); assert.equal(result.previousHours,1); assert.equal(result.delta,0);
  assert.equal(build([event('a')],[member],[entry('a','present')],'2026-09-14',Date.parse('2026-09-14T08:00:00+08:00')).players[0].hours,0);
});
test('historical explicit attendance is retained for newly registered members', () => {
  const person={...member,created_at:'2026-09-22T00:00:00Z'};
  assert.equal(build([event('a')],[person],[],'2026-09-14',now).players[0].completed,0);
  assert.equal(build([event('a')],[person],[entry('a','present')],'2026-09-14',now).players[0].hours,2);
});
