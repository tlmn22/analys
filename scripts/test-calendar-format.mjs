// Run: node scripts/test-calendar-format.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/club-event-calendar.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
function load(browserFallback) {
  const context = { exports: {}, Intl: { DateTimeFormat: function(locale, options) {
    return new Intl.DateTimeFormat(browserFallback && locale === 'mn-MN' ? 'en-US' : locale, options);
  } } };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
const server = load(false), browser = load(true);
for (const [instant, expected] of [
  ['2026-09-06T23:00:00Z', '9-р сарын 7 07:00'],
  ['2026-09-07T10:00:00Z', '9-р сарын 7 18:00'],
  ['2026-09-30T16:00:00Z', '10-р сарын 1 00:00'],
  ['2026-12-31T16:07:00Z', '1-р сарын 1 00:07'],
]) {
  assert.equal(server.calendarDateTime(instant), expected);
  assert.equal(browser.calendarDateTime(instant), expected);
  assert.equal(server.calendarTime(instant), expected.slice(-5));
}
assert.equal(server.eventOnDay({ start_at: '2026-09-30T15:00:00Z', end_at: '2026-09-30T16:00:00Z' }, '2026-10-01'), false);
console.log('PASS: identical calendar text with locale fallback, 24-hour clock, midnight and year rollover');
