// Generic set operations over lists of (possibly overlapping, unsorted)
// time intervals — used to turn individual players' on-court intervals
// (from computeOnCourtIntervals) into a combo's shared ON/OFF windows:
// ON = every player in the combo on court at once (intersection), OFF =
// every player in the combo off court at once (complement of the union).
// Stretches where the combo is only partially on the floor count as
// neither ON nor OFF for that combo.

import type { Interval } from "../game-summary/timeline-stats";

function mergeSorted(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    if (iv.end <= iv.start) continue;
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

function intersectTwo(a: Interval[], b: Interval[]): Interval[] {
  const as = mergeSorted(a);
  const bs = mergeSorted(b);
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < as.length && j < bs.length) {
    const start = Math.max(as[i].start, bs[j].start);
    const end = Math.min(as[i].end, bs[j].end);
    if (start < end) result.push({ start, end });
    if (as[i].end < bs[j].end) i++;
    else j++;
  }
  return result;
}

export function intersectAll(sets: Interval[][]): Interval[] {
  if (sets.length === 0) return [];
  return sets.reduce((acc, s) => intersectTwo(acc, s));
}

export function unionAll(sets: Interval[][]): Interval[] {
  return mergeSorted(sets.flat());
}

/** Every gap in `intervals` within [start, end) — e.g. the time a group of
 * players is simultaneously off the court is the complement of the union
 * of their individual on-court intervals. */
export function complement(intervals: Interval[], start: number, end: number): Interval[] {
  const merged = mergeSorted(intervals)
    .map((iv) => ({ start: Math.max(iv.start, start), end: Math.min(iv.end, end) }))
    .filter((iv) => iv.end > iv.start);

  const result: Interval[] = [];
  let cursor = start;
  for (const iv of merged) {
    if (iv.start > cursor) result.push({ start: cursor, end: iv.start });
    cursor = Math.max(cursor, iv.end);
  }
  if (cursor < end) result.push({ start: cursor, end });
  return result;
}

export function totalDuration(intervals: Interval[]): number {
  return intervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
}

export function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}
