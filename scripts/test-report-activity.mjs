import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const compiled = ts.transpileModule(readFileSync(new URL("../lib/report-activity.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function("exports", compiled)(exports);
const { parseActivityBatch, parseReportPath, summarizeActivity, formatDuration } = exports;

const game = "35efe318-f4a0-468f-94a8-796062b910c4";
const view = "11111111-2222-4333-8444-555555555555";
const now = Date.parse("2026-10-05T03:00:00Z");
const ev = (extra) => ({ viewId: view, slug: "scouting-report", action: "view", at: now, ...extra });

test("report paths resolve to game and slug", () => {
  assert.deepEqual(parseReportPath(`/admin/tag/${game}/reports`), { gameId: game, slug: "" });
  assert.deepEqual(parseReportPath(`/admin/tag/${game}/reports/shot-chart/`), { gameId: game, slug: "shot-chart" });
  assert.equal(parseReportPath(`/admin/tag/${game}`), null);
  assert.equal(parseReportPath(`/admin/tag/not-a-uuid/reports`), null);
  assert.equal(parseReportPath(`/admin/tag/${game}/reports/Bad_Slug`), null);
});

test("valid batch becomes rows; targets only on clicks, durations only on leave", () => {
  const rows = parseActivityBatch({ gameId: game, events: [
    ev({}),
    ev({ action: "click", target: "  Man to Man \n › Sets ›  12 " }),
    ev({ action: "leave", durationSeconds: 95.6, target: "ignored" }),
  ] }, now);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].target, null);
  assert.equal(rows[1].target, "Man to Man › Sets › 12");
  assert.equal(rows[2].duration_seconds, 96);
  assert.equal(rows[2].target, null);
  assert.equal(rows[0].game_id, game);
});

test("timestamps are clamped to the last hour and never the future", () => {
  const [future, old] = parseActivityBatch({ gameId: game, events: [ev({ at: now + 60_000 }), ev({ at: now - 5 * 3600_000 })] }, now);
  assert.equal(future.created_at, new Date(now).toISOString());
  assert.equal(old.created_at, new Date(now - 3600_000).toISOString());
});

test("malformed or oversized batches are rejected", () => {
  assert.equal(parseActivityBatch(null, now), null);
  assert.equal(parseActivityBatch({ gameId: "x", events: [ev({})] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: Array.from({ length: 51 }, () => ev({})) }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [ev({ action: "delete" })] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [ev({ viewId: "x" })] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [ev({ action: "leave" })] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [ev({ slug: "../x" })] }, now), null);
  assert.equal(parseActivityBatch({ gameId: game, events: [ev({ action: "click", target: "x".repeat(500) })] }, now)[0].target.length, 200);
});

test("summary groups by person, game and report", () => {
  const row = (staff_id, report_slug, action, created_at, duration_seconds = null) => ({ staff_id, game_id: game, report_slug, action, created_at, duration_seconds });
  const summary = summarizeActivity([
    row("a", "shot-chart", "view", "2026-10-05T01:00:00Z"),
    row("a", "shot-chart", "click", "2026-10-05T01:01:00Z"),
    row("a", "shot-chart", "leave", "2026-10-05T01:02:00Z", 120),
    row("a", "shot-chart", "view", "2026-10-05T02:00:00Z"),
    row("a", "shot-chart", "leave", "2026-10-05T02:00:30Z", 30),
    row("b", "shot-chart", "view", "2026-10-05T00:00:00Z"),
  ]);
  assert.deepEqual(summary.map((s) => [s.staffId, s.views, s.seconds, s.clicks, s.lastAt]), [
    ["a", 2, 150, 1, "2026-10-05T02:00:30Z"],
    ["b", 1, 0, 0, "2026-10-05T00:00:00Z"],
  ]);
});

test("durations format as m:ss or h:mm:ss", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(95), "1:35");
  assert.equal(formatDuration(3725), "1:02:05");
});
