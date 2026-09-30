export const CLUB_TIME_ZONE = "Asia/Ulaanbaatar";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLUB_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

// Assemble visible text ourselves: browsers may fall back from mn-MN to
// English while the server supports Mongolian, causing hydration mismatches.
const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE, calendar: "gregory", numberingSystem: "latn",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function calendarTime(instant: string | Date): string {
  const parts = clockFormatter.formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("hour").padStart(2, "0")}:${part("minute").padStart(2, "0")}`;
}

export function calendarDateTime(instant: string | Date): string {
  const day = calendarDay(instant);
  return `${Number(day.slice(5, 7))}-р сарын ${Number(day.slice(8, 10))} ${calendarTime(instant)}`;
}

export function calendarDay(instant: string | Date): string {
  const parts = dayFormatter.formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function monthDays(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(first);
    day.setUTCDate(day.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function eventOnDay(event: { start_at: string; end_at: string }, day: string): boolean {
  const start = new Date(event.start_at);
  // An event ending at midnight belongs to the preceding day.
  const last = new Date(Math.max(start.getTime(), new Date(event.end_at).getTime() - 1));
  return calendarDay(start) <= day && calendarDay(last) >= day;
}
