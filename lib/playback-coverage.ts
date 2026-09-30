// Merge actually played intervals; seeking and replaying the same seconds adds no coverage.
export function addPlaybackInterval(intervals: [number, number][], start: number, end: number): [number, number][] {
  if (!(end > start)) return intervals;
  const sorted = [...intervals, [start, end] as [number, number]].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  return merged;
}
