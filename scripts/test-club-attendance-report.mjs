import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/club-attendance-report.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exported = {};
new Function("exports", compiled)(exported);
const { buildAttendanceReport: build, attendanceRate, emptyCounts } = exported;
const now = Date.parse("2026-09-23T12:00:00Z");
const event = (id, overrides = {}) => ({ id, club_id: "a", start_at: "2026-09-22T01:00:00Z", end_at: "2026-09-22T03:00:00Z", event_type: "gym_prep", ...overrides });
const member = (id, overrides = {}) => ({ id, club_id: "a", first_name: id, last_name: "Test", role: "player", created_at: "2026-09-01T00:00:00Z", ...overrides });
const entry = (event_id, club_staff_id, status) => ({ event_id, club_staff_id, status });

test("member sorting supports numeric columns in both directions and keeps missing rates last", () => {
  const rows = build([event("one")], [member("a"), member("b"), member("c")], [entry("one", "a", "absent"), entry("one", "b", "present")], now).people;
  const order = (key, direction) => [...rows].sort((a, b) => exported.compareMembers(a, b, key, direction)).map(p => p.member.id);
  assert.deepEqual(order("rate", "desc"), ["b", "a", "c"]);
  assert.deepEqual(order("rate", "asc"), ["a", "b", "c"]);
  assert.deepEqual(order("absent", "desc"), ["a", "b", "c"]);
  assert.deepEqual(order("present", "desc"), ["b", "a", "c"]);
  assert.deepEqual(order("name", "desc"), ["c", "b", "a"]);
});

test("mixed-script names and numeric ties have identical order without runtime collation", () => {
  const names = ["Jamille", "Үүр", "Өлзий", "Анар", "Уран", "Онон", "Trevon"];
  const rows = build([], names.map(name => member(name)), [], now).people;
  const original = String.prototype.localeCompare;
  try {
    String.prototype.localeCompare = () => { throw new Error("Runtime collation must not determine rendered row order"); };
    const expected = ["Анар", "Онон", "Өлзий", "Уран", "Үүр", "Jamille", "Trevon"];
    for (const key of ["name", "events", "rate", "present"]) {
      assert.deepEqual([...rows].sort((a, b) => exported.compareMembers(a, b, key, "asc")).map(p => p.member.id), expected);
    }
    assert.deepEqual([...rows].sort((a, b) => exported.compareMembers(a, b, "name", "desc")).map(p => p.member.id), [...expected].reverse());
    assert.ok(exported.compareMemberNames(member("a", { first_name: "Анар" }), member("b", { first_name: "анар" })) < 0);
    assert.equal(exported.compareMemberNames(member("same", { first_name: "Й" }), member("same", { first_name: "И\u0306" })), 0);
  } finally {
    String.prototype.localeCompare = original;
  }
});

test("member details preserve historical saved entries, exclude other clubs and distinguish unmarked and future events", () => {
  const person = member("p", { created_at: "2026-09-22T00:00:00Z" });
  const events = [event("old", { start_at: "2026-09-20T00:00:00Z" }), event("saved", { start_at: "2026-09-21T00:00:00Z" }), event("one"), event("other", { club_id: "b" }), event("future", { start_at: "2026-09-25T00:00:00Z", end_at: "2026-09-25T02:00:00Z" })];
  const details = exported.memberAttendanceDetails(events, person, [entry("saved", "p", "sick"), entry("one", "someone-else", "absent")], now);
  assert.deepEqual(details.map(r => r.event.id), ["future", "one", "saved"]);
  assert.equal(details[0].completed, false);
  assert.equal(details[1].status, "unmarked");
  assert.equal(details[2].status, "sick");
});

test("sick is recorded separately but counts as nonattendance", () => {
  const result = build([event("one")], [member("p"), member("s")], [entry("one", "p", "present"), entry("one", "s", "sick")], now);
  assert.equal(result.total.sick, 1);
  assert.equal(result.total.absent, 0);
  assert.equal(result.total.excused, 0);
  assert.equal(result.marked, 2);
  assert.equal(result.expected, 2);
  assert.equal(result.rate, 50);
  assert.equal(result.eventRows[0].rate, 50);
  assert.equal(result.eventRows[0].counts.sick, 1);
  const person = result.people.find(p => p.member.id === "s");
  assert.equal(person.counts.sick, 1);
  assert.equal(person.rate, 0);
});

test("late counts as participation; excused reduces attendance while unmarked is excluded", () => {
  const people = ["p", "l", "a", "e", "u"].map((id) => member(id));
  const result = build([event("one")], people, [entry("one", "p", "present"), entry("one", "l", "late"), entry("one", "a", "absent"), entry("one", "e", "excused")], now);
  assert.deepEqual(result.total, { present: 1, late: 1, absent: 1, excused: 1, sick: 0, unmarked: 1 });
  assert.equal(result.rate, 50);
  assert.equal(result.people.find(p => p.member.id === "e").rate, 0);
  assert.equal(result.expected, 5);
  assert.equal(result.marked, 4);
  assert.equal(result.trainingHours, 2);
  assert.equal(result.people.find((p) => p.member.id === "l").rate, 100);
});

test("zero attendance is distinct from no data", () => {
  assert.equal(attendanceRate(emptyCounts()), null);
  assert.equal(attendanceRate({ ...emptyCounts(), absent: 1 }), 0);
  assert.equal(attendanceRate({ ...emptyCounts(), excused: 2 }), 0);
  const result = build([event("one")], [member("a")], [], now);
  assert.equal(result.total.absent, 0);
  assert.equal(result.total.unmarked, 1);
  assert.equal(result.rate, null);
});

test("future and ongoing events do not affect recorded attendance or training hours", () => {
  const result = build([event("future", { start_at: "2026-09-24T00:00:00Z", end_at: "2026-09-24T02:00:00Z" }), event("ongoing", { end_at: "2026-09-23T13:00:00Z" })], [member("p")], [entry("future", "p", "absent"), entry("ongoing", "p", "present")], now);
  assert.equal(result.completed, 0);
  assert.equal(result.upcoming, 2);
  assert.equal(result.expected, 0);
  assert.equal(result.trainingHours, 0);
});

test("clubs cannot contaminate each other's numerator or expected participants", () => {
  const result = build([event("one")], [member("a"), member("b", { club_id: "b" })], [entry("one", "b", "absent"), entry("one", "a", "present")], now);
  assert.equal(result.expected, 1);
  assert.equal(result.rate, 100);
  assert.equal(result.people.find((p) => p.member.id === "b").events, 0);
});

test("new members are not assumed absent from old events; explicit historical entries remain counted", () => {
  const people = [member("new", { created_at: "2026-09-23T00:00:00Z" })];
  assert.equal(build([event("one")], people, [], now).expected, 0);
  assert.equal(build([event("one")], people, [entry("one", "new", "present")], now).total.present, 1);
});

test("meeting duration is not reported as training time", () => {
  const result = build([event("meeting", { event_type: "team_meeting" }), event("fitness", { event_type: "fitness_prep" })], [], [], now);
  assert.equal(result.completed, 2);
  assert.equal(result.trainingCount, 1);
  assert.equal(result.trainingHours, 2);
});

test("filters do not retain excluded event or member counts", () => {
  const result = build([event("one")], [member("p")], [entry("one", "p", "present"), entry("two", "p", "absent"), entry("one", "excluded", "late")], now);
  assert.deepEqual(result.total, { present: 1, late: 0, absent: 0, excused: 0, sick: 0, unmarked: 0 });
});

test("overall rate is weighted by attendance records rather than averaging individual percentages", () => {
  const result = build([event("one"), event("two")], [member("p"), member("q")], [entry("one", "p", "present"), entry("two", "p", "absent"), entry("one", "q", "present")], now);
  assert.equal(result.rate, 2 / 3 * 100);
  assert.equal(result.total.unmarked, 1);
});
