import type { AttendanceStatus, ClubEvent } from "./types";
import type { ReportAttendance, ReportMember } from "./club-attendance-report";

export type LoadBand = "low" | "normal" | "high" | "over";
export function loadBand(hours: number): LoadBand {
  if (hours < 15) return "low";
  if (hours <= 20) return "normal";
  if (hours <= 24) return "high";
  return "over";
}
export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekMonday(day: string) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return shiftDay(day, -(weekday + 6) % 7);
}

export function buildLoadMonitoring(events: ClubEvent[], members: ReportMember[], attendance: ReportAttendance[], from: string, now: number) {
  const start = Date.parse(`${from}T00:00:00+08:00`);
  const end = Date.parse(`${shiftDay(from, 7)}T00:00:00+08:00`);
  const weekComplete = now >= end;
  const training = [...new Map(events.filter(e => ["gym_prep", "fitness_prep"].includes(e.event_type)).map(e => [e.id, e])).values()];
  const saved = new Map(attendance.map(a => [`${a.event_id}:${a.club_staff_id}`, a.status]));
  function period(member: ReportMember, periodStart: number, periodEnd: number) {
    const sessions = training.filter(e => e.club_id === member.club_id && Date.parse(e.start_at) < periodEnd && Date.parse(e.end_at) > periodStart)
      .filter(e => saved.has(`${e.id}:${member.id}`) || Date.parse(member.created_at) <= Date.parse(e.start_at))
      .map(event => {
        const status = saved.get(`${event.id}:${member.id}`) ?? "unmarked";
        const completed = Date.parse(event.end_at) <= now;
        const duration = Math.max(0, Math.min(Date.parse(event.end_at), periodEnd) - Math.max(Date.parse(event.start_at), periodStart)) / 3600000;
        const participated = status === "present" || status === "late";
        return { event, status: status as AttendanceStatus | "unmarked", completed, duration, hours: completed && participated ? duration : 0 };
      }).sort((a, b) => Date.parse(a.event.start_at) - Date.parse(b.event.start_at));
    const hours = sessions.reduce((total, s) => total + s.hours, 0);
    const missing = sessions.filter(s => s.completed && s.status === "unmarked").length;
    const completed = sessions.filter(s => s.completed).length;
    const late = sessions.filter(s => s.completed && s.status === "late").length;
    return { sessions, hours, missing, completed, late, participated: sessions.filter(s => s.hours > 0).length,
      coverage: completed ? (completed - missing) / completed * 100 : null };
  }
  const players = members.filter(m => m.role === "player").map(member => {
    const current = period(member, start, end);
    const previous = period(member, start - 7 * 86400000, start);
    const completeData = weekComplete && current.completed > 0 && current.missing === 0;
    return { member, ...current, previousHours: previous.completed && !previous.missing ? previous.hours : null,
      delta: completeData && previous.completed && !previous.missing ? current.hours - previous.hours : null,
      band: completeData ? loadBand(current.hours) : null };
  });
  return { players, weekComplete };
}
