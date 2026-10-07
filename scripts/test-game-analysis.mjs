import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const load = (path) => {
  const exports = {};
  new Function("exports", ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports);
  return exports;
};
const { computeFourFactors, computePeriodScores } = load("../app/admin/tag/[gameId]/reports/game-analysis-stats.ts");
const { analysisProblems, parseAnalysis } = load("../lib/game-analysis.ts");
const ev = (eventType, teamId, extra = {}) => ({ eventType, teamId, period: 1, points: null, ...extra });

test("four factors follow the standard formulas", () => {
  const events = [
    ev("2pt_made", "H"), ev("3pt_made", "H"), ev("2pt_miss", "H"), ev("3pt_miss", "H"),
    ev("ft_made", "H"), ev("ft_miss", "H"), ev("off_reb", "H"), ev("turnover", "H"),
    ev("def_reb", "V"), ev("def_reb", "V"), ev("def_reb", "V"),
  ];
  // eFG = (2 + 0.5*1)/4 = 62.5; TOV = 1/10; ORB = 1/(1+3); FTr = 2/4
  assert.deepEqual(computeFourFactors(events, "H", "V", 10), { eFGPct: 62.5, tovPct: 10, orbPct: 25, ftRate: 0.5 });
  assert.deepEqual(computeFourFactors([], "H", "V", 0), { eFGPct: 0, tovPct: 0, orbPct: 0, ftRate: 0 });
});

test("period scores label quarters and overtimes", () => {
  const events = [ev("2pt_made", "H", { points: 2 }), ev("3pt_made", "V", { points: 3, period: 4 }), ev("ft_made", "H", { points: 1, period: 5 })];
  assert.deepEqual(computePeriodScores(events, "H", "V").map((p) => [p.label, p.home, p.visitor]), [["Q1", 2, 0], ["Q2", 0, 0], ["Q3", 0, 0], ["Q4", 0, 3], ["OT1", 1, 0]]);
});

test("analysis documents are validated", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  const bi = { mn: "а", en: "a" };
  const doc = { version: 2, summary: bi, deciders: [{ title: bi, text: bi, playerId: id }], teamSections: [{ teamId: id, offense: [bi], defense: [] }],
    players: [{ playerId: id, verdict: "good", text: bi }], keys: [{ title: bi, items: [bi] }], caveats: [] };
  assert.deepEqual(analysisProblems(doc), []);
  assert.ok(parseAnalysis(JSON.stringify(doc)));
  assert.deepEqual(analysisProblems({ ...doc, summary: { mn: "x" } }), ["summary"]);
  assert.deepEqual(analysisProblems({ ...doc, players: [{ playerId: id, verdict: "great", text: bi }] }), ["players"]);
  assert.equal(parseAnalysis("## old markdown"), null);
  assert.equal(parseAnalysis(JSON.stringify({ ...doc, version: 1 })), null);
});
