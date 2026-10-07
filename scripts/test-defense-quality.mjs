import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const exports = {};
new Function("exports", ts.transpileModule(readFileSync(new URL("../app/admin/tag/[gameId]/reports/defense-quality/defense-quality-stats.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(exports);
const { computeDefenseQualityRows, sumDefenseRows, netScore } = exports;
const ev = (eventType, playerId, extra = {}, teamId = "H") => ({ eventType, playerId, teamId, ...extra });

test("defensive tags are grouped per player, weakest first", () => {
  const events = [
    ev("good_defense", "a", { defenseType: "Save Mid" }),
    ev("bad_defense", "b", { defenseType: "Lost Mid" }),
    ev("bad_defense", "b", { defenseType: "Bad Help" }),
    ev("help_defense", "a", { helpDefenseType: "Normal" }),
    ev("help_defense", "b", { helpDefenseType: "Good" }),
    ev("boxout", "a", { boxoutType: "Bad" }),
    ev("boxout", "c", { boxoutType: "Good" }),
    ev("bad_defense", "z", { defenseType: "Lost Mid" }, "V"),
    ev("2pt_made", "a"),
  ];
  const rows = computeDefenseQualityRows(events, "H");
  assert.deepEqual(rows.map((r) => [r.playerId, netScore(r)]), [["b", -1], ["a", 0], ["c", 1]]);
  assert.equal(rows.find((r) => r.playerId === "a").help.Normal.length, 1);
  const total = sumDefenseRows(rows);
  assert.deepEqual([total.good["Save Mid"].length, total.bad["Lost Mid"].length, total.boxoutBad.length, netScore(total)], [1, 1, 1, 0]);
});
