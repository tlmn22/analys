// Run: node scripts/test-tag-workspace.mjs (isolated mocks; no live database).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const base = "app/admin/tag/[gameId]/";
function load(file, resolve) {
  const loadedModule = { exports: {} };
  const source = readFileSync(new URL(`../${base}${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  new Function("require", "module", "exports", outputText)(resolve, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const cleanup = load("event-detail-cleanup.ts", require);
const decisionModule = { exports: {} };
const decisionSource = ts.transpileModule(readFileSync(new URL('../lib/decision-quality.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('require','module','exports',decisionSource)(() => loadDefinitions(), decisionModule, decisionModule.exports);
const decision = decisionModule.exports;

const dbEvents = new Map();
const insertServer = load("actions.ts", name => {
  if (name === "./event-detail-cleanup") return cleanup;
  if (name === "@/lib/decision-quality") return decision;
  if (name === "@/lib/club-event-access") return { requireSuperadmin: async () => {} };
  if (name === "@/lib/supabase/server") return { supabaseAdmin: () => ({ from: () => ({
    upsert: (row, options) => ({ select: () => ({ maybeSingle: async () => {
      assert.equal(options.ignoreDuplicates, true);
      if (dbEvents.has(row.id)) return { data: null, error: null };
      dbEvents.set(row.id, row); return { data: { id: row.id }, error: null };
    } }) }),
  }) }) };
  throw new Error(name);
});
const insertInput = { id: 'stable-id', gameId: 'game', period: 1, clockTime: 500, videoTime: 100,
  eventType: '2pt_made', teamId: 'home', playerId: 'player', points: 2, decisionQuality: 'good' };
assert.equal((await insertServer.tagEvent(insertInput)).id, 'stable-id');
assert.equal((await insertServer.tagEvent(insertInput)).id, 'stable-id');
assert.equal(dbEvents.size, 1);
assert.equal(dbEvents.get("stable-id").decision_quality, "good");
assert.ok((await insertServer.tagEvent({ ...insertInput, clockTime: -1 })).error);
let row;
const server = load("actions.ts", (name) => {
  if (name === "./event-detail-cleanup") return cleanup;
  if (name === "@/lib/decision-quality") return decision;
  if (name === "@/lib/club-event-access") return { requireSuperadmin: async () => {} };
  if (name === "@/lib/supabase/server") return {
    supabaseAdmin: () => ({ from: () => ({ update: (patch) => ({
      eq: async () => { Object.assign(row, patch); return {}; },
    }) }) }),
  };
  throw new Error(name);
});
const shot = { assist_player_id: "assist", shot_type: "layup", shot_x: 20,
  shot_y: 30, and_one: true, defender_player_id: "defender" };
row = { ...shot };
await server.updateEvent({ id: "e", eventType: "turnover", typeValue: "Travel" });
for (const key of ["assist_player_id", "shot_type", "shot_x", "shot_y", "defender_player_id"])
  assert.equal(row[key], null);
assert.equal(row.and_one, false);
assert.equal(row.turnover_type, "Travel");
row = { ...shot };
await server.updateEvent({ id: "e", eventType: "3pt_made", typeValue: null });
for (const key of Object.keys(shot)) assert.equal(row[key], shot[key]);
await server.updateEvent({ id: "e", eventType: "3pt_miss", typeValue: null });
assert.equal(row.assist_player_id, null);
assert.equal(row.and_one, false);
assert.equal(row.shot_x, 20);
row = { foul_bad_call: true, screener_player_id: "s", screen_target_player_id: "t",
  physical_contact_second_player_id: "p", physical_contact_winner_player_id: "w",
  blob_outcome: "score", slob_outcome: "score" };
await server.updateEvent({ id: "e", eventType: "turnover", typeValue: null });
assert.equal(row.foul_bad_call, false);
for (const key of ["screener_player_id", "screen_target_player_id", "physical_contact_second_player_id",
  "physical_contact_winner_player_id", "blob_outcome", "slob_outcome"]) assert.equal(row[key], null);

let states = [], index = 0, refs = [], refIndex = 0, failUpdate = false, failTagOnce = false;
const writes = [], saved = new Map(), restored = [];
let clock = 500, videoTime = 100, playing = true, pauses = 0, plays = 0;
const video = { getSnapshot: () => ({ clockTime: clock, videoTime }), resetClock: () => { clock = 600; },
  isReady: () => true, isPlaying: () => playing, pause: () => { pauses++; playing = false; },
  play: () => { plays++; playing = true; }, seekTo: t => { videoTime = t; }, setClock: t => { clock = t; } };
const react = {
  useEffect() {},
  useState(initial) {
    const i = index++;
    if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial;
    return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }];
  },
  useMemo: fn => fn(),
  useRef(initial) { const i = refIndex++; return refs[i] ??= { current: i === 0 ? video : initial }; },
};
const actions = {
  updateEvent: async () => failUpdate ? { error: "Failed" } : {},
  deleteEvent: async () => ({}),
  restoreLineup: async (...args) => { restored.push(args); return {}; },
  undoTagEvents: async (_game, ids) => { ids.forEach(id => saved.delete(id)); return {}; },
  updateShotDetails: async () => ({}),
  tagEvent: async input => {
    writes.push(input); saved.set(input.id, input);
    if (failTagOnce) { failTagOnce = false; throw new Error("Response interrupted"); }
    return { id: input.id };
  },
};
const definitions = loadDefinitions();
function loadDefinitions() {
  const file = readFileSync(new URL('../lib/tag-events.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(file, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const loaded = { exports: {} }; new Function('require','module','exports',output)(require,loaded,loaded.exports); return loaded.exports;
}
const components = {};
function resolve(name) {
  if (name === "react") return react;
  if (name === "react/jsx-runtime") return require(name);
  if (name === "./actions") return actions;
  if (name === "./event-detail-cleanup") return cleanup;
  if (name === "@/lib/decision-quality") return decision;
  if (name === "@/lib/tag-events") return definitions;
  if (name === "./types") return { playerLabel: p => p.playerId };
  return components[name] ??= new Proxy({}, { get: (target, key) => target[key] ??= function Component() {} });
}
const { TagWorkspace } = load("tag-workspace.tsx", resolve);
const player = { playerId: "p" }, bench = { playerId: "bench" }, opponent = { playerId: "opp" };
const original = { id: "e", eventType: "2pt_made", teamId: "h", playerId: "p", points: 2,
  shotType: "layup", assistPlayerLabel: "assist", defenderLabel: "defender" };
const props = {
  decisionEnabled: true, gameId: "g", homeTeam: { id: "h", name: "H", roster: [player, bench] },
  visitorTeam: { id: "v", name: "V", roster: [opponent] }, initialLineup: { h: [null,null,null,null,null], v: [opponent,null,null,null,null] },
  initialEvents: [original], initialPlayNames: {}, initialPeriod: 1, initialClockTime: 600,
  initialVideoTime: 0, initialOffTeamId: "h", initialDefTeamId: "v",
};
function render() { index = 0; refIndex = 0; return TagWorkspace(props); }
function all(node, predicate) {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(n => all(n, predicate));
  return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
}
function find(node, type) { return all(node, n => n.type === type)[0]; }
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node?.props ? text(node.props.children) : "";
}
const panel = (path, name) => find(render(), resolve(path)[name]).props;
const button = label => all(render(), n => n.props?.onClick && text(n) === label)[0].props;
const flush = () => new Promise(resolve => setImmediate(resolve));
function edit(event) {
  panel("./events-panel", "EventsPanel").onEdit(event);
  return panel("./edit-event-modal", "EditEventModal");
}
await edit(original).onUpdate({ ...original, points: 3, eventType: "3pt_made" });
assert.ok(text(render()).includes("H 3 — V 0"));
await edit(states[5][0]).onUpdate({ ...states[5][0], teamId: "v" });
assert.ok(text(render()).includes("H 0 — V 3"));
failUpdate = true;
await edit(states[5][0]).onUpdate({ ...states[5][0], points: 9 });
assert.ok(text(render()).includes("H 0 — V 3"));
failUpdate = false;
button('Дахин оролдох').onClick(); await flush();
assert.ok(text(render()).includes("H 0 — V 9"));
await edit(states[5][0]).onUpdate({ ...states[5][0], eventType: "turnover", points: null });
assert.equal(states[5][0].assistPlayerLabel, null);
assert.equal(states[5][0].shotType, null);
await edit(states[5][0]).onUpdate({ ...states[5][0], eventType: "2pt_made", points: 2 });
await edit(states[5][0]).onDelete();
assert.equal(states[5].length, 0);
assert.ok(text(render()).includes("H 0 — V 0"));
function details(andOne) { return { andOne, badMiss: false, contestedClose: false, lateClock: false, lightlyContested: false, uncontested: false, wideOpen: false, shotQuality: 7, shotType: 'Layup', shotX: 20, shotY: 30 }; }
function trigger(type) {
  const def = type === 'sub' ? { type: 'sub' } : definitions.EDITABLE_EVENTS.find(e => e.type === type);
  panel('./action-panel','ActionPanel').onEventTriggered(def);
}
trigger('sub');
await panel('./substitution-panel','SubstitutionPanel').onSlotSet('h',1,player);
assert.deepEqual(writes.map(e => e.eventType), ['sub_in']);
assert.equal(states[4].h[0],player);
trigger('sub');
await panel('./substitution-panel','SubstitutionPanel').onSlotSet('h',1,bench);
assert.deepEqual(writes.slice(1).map(e => [e.eventType,e.playerId]), [['sub_out','p'],['sub_in','bench']]);
await button('↶ Буцаах').onClick();
assert.equal(states[4].h[0],player);
assert.deepEqual(restored.at(-1)[2], ['p',null,null,null,null]);
assert.equal(states[5].length,1);
// Timestamp is captured at trigger; retries share the original UUID and cannot double-score.
playing = true; clock = 480; videoTime = 120;
trigger('2pt_made');
assert.equal(playing,false);
clock = 470; videoTime = 130;
failTagOnce = true;
panel('./decision-quality-picker','DecisionQualityPicker').onChange('bad');
panel('./decision-quality-picker','DecisionQualityPicker').onChange('good');
const shotPanel = panel('./shot-detail-panel','ShotDetailPanel');
assert.equal(writes.at(-1).eventType, 'sub_in');
shotPanel.onDone(player, details(false), null, null); shotPanel.onDone(player, details(false), null, null);
await flush();
const attemptedId = writes.at(-1).id;
button('Дахин оролдох').onClick(); await flush();
assert.equal(writes.at(-1).id,attemptedId);
assert.equal(writes.at(-1).clockTime,480);
assert.equal(writes.at(-1).decisionQuality,'good');
assert.equal(states[5].find(e => e.id === attemptedId).decisionQuality,'good');
assert.equal(writes.at(-1).videoTime,120);
assert.equal(states[5].filter(e => e.id === attemptedId).length,1);
assert.ok(text(render()).includes('H 2 — V 0'));
assert.equal(playing,true);
await button('↶ Буцаах').onClick();
assert.equal(states[2],'h'); assert.equal(clock,480); assert.equal(videoTime,120);
// And-one retains offense until the final free throw.
trigger('2pt_made'); panel('./shot-detail-panel','ShotDetailPanel').onDone(player,details(true),null,null); await flush();
assert.equal(states[2],'h');
trigger('ft_made'); panel('./player-picker-panel','PlayerPickerPanel').onDone(player,true); await flush();
assert.equal(states[2],'v');
await button('↶ Буцаах').onClick(); assert.equal(states[2],'h');
// A missed shot suggests a rebound and def rebound changes possession once.
trigger('2pt_miss'); panel('./shot-detail-panel','ShotDetailPanel').onDone(player,details(false),null,null); await flush();
assert.ok(text(render()).includes('Самбарыг хэн авсан?'));
trigger('def_reb'); panel('./player-picker-panel','PlayerPickerPanel').onDone(opponent); await flush();
assert.equal(states[2],'v');
assert.ok(pauses > 0 && plays > 0);
clock = 5; videoTime = 200;
panel('./action-panel','ActionPanel').onEventTriggered({ type: 'end_quarter', label: 'End Quarter', color: 'gray', needsPlayer: false });
await flush(); assert.equal(states[0],2); assert.equal(clock,600);
await button('↶ Буцаах').onClick(); assert.equal(states[0],1); assert.equal(clock,5);
playing = false;
const playsBeforeCancel = plays;
trigger('2pt_miss'); panel('./shot-detail-panel','ShotDetailPanel').onCancel();
assert.equal(plays,playsBeforeCancel);
const writesBeforeTurnover = writes.length;
trigger('turnover');
assert.ok(panel('./type-detail-panel','TypeDetailPanel'));
assert.equal(writes.length,writesBeforeTurnover);
panel('./type-detail-panel','TypeDetailPanel').onCancel();
console.log('PASS: scores, metadata, lineup, grouped undo, timestamp capture, pause/resume, duplicate suppression, retry, and-one/final FT, rebound');

const summary = decision.summarizeDecisions([
  { id: 'a', event_type: '2pt_miss', team_id: 'h', player_id: 'p', decision_quality: 'good' },
  { id: 'a', event_type: '2pt_miss', team_id: 'h', player_id: 'p', decision_quality: 'good' },
  { id: 'b', event_type: '2pt_made', team_id: 'h', player_id: 'p', decision_quality: 'bad' },
  { id: 'c', event_type: 'turnover', team_id: 'h', player_id: 'p', decision_quality: null },
  { id: 'd', event_type: 'def_reb', team_id: 'h', player_id: 'p', decision_quality: 'good' },
  { id: 'e', event_type: 'assist', team_id: 'h', player_id: 'other', decision_quality: null },
]);
assert.equal(summary[0].good, 1); assert.equal(summary[0].bad, 1);
assert.equal(summary[0].ungraded, 1); assert.equal(summary[0].percentage, 50);
assert.equal(summary[1].percentage, null);
assert.equal(decision.normalizeDecisionQuality('def_reb','p','good'), null);
assert.equal(decision.normalizeDecisionQuality('turnover',null,'good'), null);
row = { decision_quality: 'good' };
await server.updateEvent({ id: 'e', eventType: 'turnover', playerId: 'p', decisionQuality: 'bad', typeValue: null });
assert.equal(row.decision_quality, 'bad');
await server.updateEvent({ id: 'e', eventType: 'turnover', playerId: 'p', decisionQuality: null, typeValue: null });
assert.equal(row.decision_quality, null);
await server.updateEvent({ id: 'e', eventType: 'def_reb', playerId: 'p', decisionQuality: 'good', typeValue: null });
assert.equal(row.decision_quality, null);
const { DecisionQualityPicker } = load('decision-quality-picker.tsx', require);
let value = null;
function renderPicker() { return DecisionQualityPicker({ value, onChange: next => { value = next; } }); }
let boxes = all(renderPicker(), n => n.type === 'input');
boxes[0].props.onChange({ target: { checked: true } });
boxes = all(renderPicker(), n => n.type === 'input');
assert.equal(boxes[0].props.checked, true); assert.equal(boxes[1].props.checked, false);
boxes[1].props.onChange({ target: { checked: true } });
boxes = all(renderPicker(), n => n.type === 'input');
assert.equal(boxes[0].props.checked, false); assert.equal(boxes[1].props.checked, true);
boxes[1].props.onChange({ target: { checked: false } });
assert.equal(value, null);
console.log('PASS: decision selection exclusivity, persistence/retry, edit/clear, offensive eligibility, report denominator, ungraded and duplicate handling');
