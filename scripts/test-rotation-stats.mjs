import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../app/admin/tag/[gameId]/reports/scouting-report/rotation-stats.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { computeStarters, splitRotation } = exports;
let v = 0;
const ev = (period, clockTime, eventType, teamId, playerId) => ({ period, clockTime, videoTime: v++, eventType, teamId, playerId });

test("starters come from opening sub_in or lineup_set, ignoring later subs and other teams", () => {
  const events = [
    ev(1, 593, "screen_rcvd", "H", "x"), // tagged earlier in video but later on the clock
    ...["a", "b", "c", "d", "e"].map((p) => ev(1, 600, "sub_in", "H", p)),
    ev(1, 600, "sub_in", "V", "v1"),
    ev(1, 420, "sub_out", "H", "a"), ev(1, 420, "sub_in", "H", "f"),
    ev(2, 600, "lineup_set", "H", "g"),
  ];
  assert.deepEqual([...computeStarters(events, "H")].sort(), ["a", "b", "c", "d", "e"]);
  assert.deepEqual([...computeStarters([...["a", "b"].map((p) => ev(1, 600, "lineup_set", "H", p))], "H")].sort(), ["a", "b"]);
});

test("a swap at the opening clock is applied; no opening lineup means no starters", () => {
  const events = [ev(1, 600, "sub_in", "H", "a"), ev(1, 600, "sub_out", "H", "a"), ev(1, 600, "sub_in", "H", "b")];
  assert.deepEqual([...computeStarters(events, "H")], ["b"]);
  assert.equal(computeStarters([ev(1, 590, "2pt_made", "H", "a")], "H").size, 0);
});

test("points split between starters and bench", () => {
  const stats = [{ playerId: "a", pts: 10, minSeconds: 1500 }, { playerId: "b", pts: 2, minSeconds: 900 }, { playerId: "c", pts: 7, minSeconds: 600 }];
  const { starters, bench } = splitRotation(stats, new Set(["a", "b"]));
  assert.equal(starters.points, 12);
  assert.deepEqual(bench.players.map((p) => p.playerId), ["c"]);
  assert.equal(bench.points, 7);
});
