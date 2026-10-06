import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Tiny CommonJS loader so coaching-stats.ts can pull in pace-stats.ts and lib/tag-events.ts.
const root = new URL("../", import.meta.url);
const reports = "app/admin/tag/[gameId]/reports/";
const files = {
  "@/lib/tag-events": "lib/tag-events.ts",
  "../game-summary/pace-stats": `${reports}game-summary/pace-stats.ts`,
  coaching: `${reports}coaching-stats/coaching-stats.ts`,
  screens: `${reports}screens-pnr/screen-stats.ts`,
  boxout: `${reports}scouting-report/boxout-stats.ts`,
};
const cache = {};
function load(id) {
  if (cache[id]) return cache[id];
  const source = readFileSync(new URL(files[id], root), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const exports = (cache[id] = {});
  new Function("exports", "require", outputText)(exports, load);
  return exports;
}
const { computeSetCategoryTotals, computeDefenseSetDetailRows } = load("coaching");
const { computePossessions } = load("../game-summary/pace-stats");
const { computeActionRows } = load("screens");
const { computeBoxoutSummary, boxoutRate } = load("boxout");

const H = "home", V = "visitor";
let n = 0;
const ev = (t, eventType, teamId, extra = {}) => ({ id: `e${n++}`, t, period: 1, eventType, teamId, points: extra.points ?? null, andOne: false, ...extra });
const row = (rows, category) => rows.find(r => r.category === category);

test("untagged defense counts every opponent trip as man to man", () => {
  const events = [
    ev(10, "2pt_made", V, { points: 2 }),
    ev(30, "3pt_miss", H), ev(31, "def_reb", V),
    ev(50, "turnover", V),
    ev(70, "3pt_made", H, { points: 3 }),
    ev(90, "2pt_miss", V), ev(91, "def_reb", H),
  ];
  const rows = computeSetCategoryTotals(events, H, V, "defense", 0, Infinity);
  assert.equal(row(rows, "unassigned"), undefined);
  const man = row(rows, "man_to_man");
  assert.equal(man.sets, 3);
  assert.equal(man.points, 2);
  assert.equal(man.to, 1);
  assert.equal(man.fga2, 2);
  const detail = computeDefenseSetDetailRows(events, H, V, 0, Infinity);
  assert.deepEqual(detail.map(r => [r.key, r.totals.sets]), [["man_to_man::Half-court man", 3]]);
});

test("a zone call stays in effect until man to man is called again", () => {
  const events = [
    ev(10, "2pt_made", V, { points: 2 }),
    ev(20, "2pt_made", H, { points: 2 }),
    ev(25, "zone", H, { zoneType: "2-3" }),
    ev(30, "3pt_made", V, { points: 3 }),
    ev(40, "2pt_made", H, { points: 2 }),
    ev(50, "turnover", V),
    ev(60, "2pt_made", H, { points: 2 }),
    ev(65, "man_to_man", H, { manToManType: "Pressure man" }),
    ev(70, "2pt_miss", V), ev(71, "def_reb", H),
  ];
  const rows = computeSetCategoryTotals(events, H, V, "defense", 0, Infinity);
  assert.equal(row(rows, "man_to_man").sets, 2);
  assert.equal(row(rows, "zone").sets, 2);
  assert.equal(row(rows, "zone").points, 3);
  const detail = computeDefenseSetDetailRows(events, H, V, 0, Infinity);
  assert.deepEqual(detail.map(r => [r.key, r.totals.sets]), [
    ["man_to_man::Half-court man", 1],
    ["man_to_man::Pressure man", 1],
    ["zone::2-3", 2],
  ]);
});

test("a call made mid-possession covers that possession", () => {
  const events = [ev(5, "2pt_miss", V), ev(6, "off_reb", V), ev(8, "zone", H, { zoneType: "2-3" }), ev(12, "2pt_made", V, { points: 2 })];
  const rows = computeSetCategoryTotals(events, H, V, "defense", 0, Infinity);
  assert.equal(row(rows, "zone").sets, 1);
  assert.equal(row(rows, "man_to_man").sets, 0);
});

test("a period opening with a defense call gives the ball to the other team", () => {
  const events = [ev(2, "zone", H, { zoneType: "2-3" }), ev(10, "2pt_made", V, { points: 2 }), ev(30, "2pt_made", H, { points: 2 })];
  assert.deepEqual(computePossessions(events, H, V).map(p => p.teamId), [V, H]);
  assert.equal(row(computeSetCategoryTotals(events, H, V, "defense", 0, Infinity), "zone").sets, 1);
});

test("a steal ends the trip once, even with a turnover tagged too", () => {
  const events = [
    ev(10, "2pt_made", V, { points: 2 }),
    ev(20, "2pt_made", H, { points: 2 }),
    ev(30, "steal", H), ev(30, "turnover", V),
    ev(40, "2pt_made", H, { points: 2 }),
    ev(45, "steal", H),
    ev(50, "2pt_made", H, { points: 2 }),
  ];
  assert.deepEqual(computePossessions(events, H, V).map(p => p.teamId), [V, H, V, H, V, H]);
  const man = row(computeSetCategoryTotals(events, H, V, "defense", 0, Infinity), "man_to_man");
  assert.equal(man.sets, 3);
  assert.equal(man.to, 1);
  assert.equal(man.noOutcomeSets, 1); // steal-only trip: no turnover tagged
});

test("offense rows are unchanged", () => {
  const events = [ev(10, "2pt_made", V, { points: 2 }), ev(20, "2pt_made", H, { points: 2 })];
  const rows = computeSetCategoryTotals(events, H, V, "offense", 0, Infinity);
  assert.equal(row(rows, "unassigned").sets, 1);
  assert.equal(row(rows, "unassigned").points, 2);
});

test("pnr coverage credits the made shot and and-one FT that end the trip", () => {
  const events = [
    ev(10, "def_coverage", H, { defCoverageType: "Drop" }),
    ev(14, "2pt_made", V, { points: 2, andOne: true }), ev(14, "ft_made", V, { points: 1 }),
    ev(30, "2pt_made", H, { points: 2 }),
    ev(40, "def_coverage", H, { defCoverageType: "Switch" }),
    ev(45, "3pt_miss", V), ev(46, "def_reb", H),
  ];
  const rows = computeActionRows(events, H, V, "defense", "def_coverage", e => e.defCoverageType, computePossessions(events, H, V), 0, Infinity);
  assert.deepEqual([rows.get("Drop").points, rows.get("Drop").fgm, rows.get("Drop").fga], [3, 1, 1]);
  assert.deepEqual([rows.get("Switch").points, rows.get("Switch").fgm, rows.get("Switch").fga], [0, 0, 1]);
});

test("single-possession calls keep the basket that ends their trip", () => {
  const events = [
    ev(10, "2pt_made", V, { points: 2 }),
    ev(12, "transition", H),
    ev(15, "3pt_made", H, { points: 3 }),
    ev(30, "2pt_made", V, { points: 2 }),
    ev(40, "2pt_made", H, { points: 2 }),
  ];
  const rows = computeSetCategoryTotals(events, H, V, "offense", 0, Infinity);
  assert.equal(row(rows, "transition").points, 3);
  assert.equal(row(rows, "unassigned").points, 2);
});

test("box outs are counted per player, worst first, with opponent offensive rebounds", () => {
  const events = [
    ev(1, "boxout", H, { playerId: "a", boxoutType: "Good" }),
    ev(2, "boxout", H, { playerId: "b", boxoutType: "Bad" }),
    ev(3, "boxout", H, { playerId: "b", boxoutType: "Bad" }),
    ev(4, "boxout", H, { playerId: "a", boxoutType: "Bad" }),
    ev(5, "boxout", V, { playerId: "z", boxoutType: "Bad" }),
    ev(6, "off_reb", V, { playerId: "z" }),
    ev(7, "off_reb", H, { playerId: "a" }),
  ];
  const s = computeBoxoutSummary(events, H, V);
  assert.deepEqual(s.rows.map(r => [r.playerId, r.good.length, r.bad.length]), [["b", 0, 2], ["a", 1, 1]]);
  assert.deepEqual([s.good.length, s.bad.length, s.opponentOreb.length], [1, 3, 1]);
  assert.equal(boxoutRate(1, 3), 0.25);
  assert.equal(boxoutRate(0, 0), null);
});
