import type { AttendanceStatus, ClubEvent, ClubEventAttendance, ClubStaff } from "@/lib/types";

export type ReportMember = Pick<ClubStaff, "id" | "club_id" | "first_name" | "last_name" | "role" | "created_at">;
export type ReportAttendance = Pick<ClubEventAttendance, "event_id" | "club_staff_id" | "status">;
export type AttendanceCounts = Record<AttendanceStatus | "unmarked", number>;
export const emptyCounts = (): AttendanceCounts => ({ present: 0, late: 0, absent: 0, excused: 0, sick: 0, unmarked: 0 });

export function attendanceRate(counts: AttendanceCounts): number | null {
  const required = counts.present + counts.late + counts.absent + counts.excused + counts.sick;
  return required ? (counts.present + counts.late) / required * 100 : null;
}

export type MemberSortKey = "name" | "events" | "rate" | keyof AttendanceCounts;
type MemberSummary = ReturnType<typeof buildAttendanceReport>["people"][number];
// Explicit Mongolian order: ICU locale support differs between Node and browsers.
const nameAlphabet = "абвгдеёжзийклмноөпрстуүфхцчшщъыьэюяabcdefghijklmnopqrstuvwxyz";
function compareNameText(left: string, right: string) {
  const a = Array.from(left.normalize("NFC").toLowerCase());
  const b = Array.from(right.normalize("NFC").toLowerCase());
  const rank = (char: string) => {
    const index = nameAlphabet.indexOf(char);
    return index < 0 ? nameAlphabet.length + char.codePointAt(0)! : index;
  };
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const difference = rank(a[i]) - rank(b[i]);
    if (difference) return difference;
  }
  return a.length - b.length;
}

export function compareMemberNames(a: ReportMember, b: ReportMember) {
  return compareNameText(`${a.first_name} ${a.last_name}`, `${b.first_name} ${b.last_name}`)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function compareMembers(a: MemberSummary, b: MemberSummary, key: MemberSortKey, direction: "asc" | "desc") {
  const nameOrder = compareMemberNames(a.member, b.member);
  if (key === "name") return direction === "asc" ? nameOrder : -nameOrder;
  const left = key === "rate" ? a.rate : key === "events" ? a.events : a.counts[key];
  const right = key === "rate" ? b.rate : key === "events" ? b.events : b.counts[key];
  if (left === null || right === null) return left === right ? nameOrder : left === null ? 1 : -1;
  return (direction === "asc" ? left - right : right - left) || nameOrder;
}

export function memberAttendanceDetails(events: ClubEvent[], member: ReportMember, attendance: ReportAttendance[], now: number) {
  const saved = new Map(attendance.filter(a => a.club_staff_id === member.id).map(a => [a.event_id, a.status]));
  return events.filter(event => event.club_id === member.club_id &&
    (saved.has(event.id) || Date.parse(member.created_at) <= Date.parse(event.start_at)))
    .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))
    .map(event => ({ event, completed: Date.parse(event.end_at) <= now, status: saved.get(event.id) ?? "unmarked" as const }));
}

export function buildAttendanceReport(events: ClubEvent[], members: ReportMember[], attendance: ReportAttendance[], now: number) {
  const recorded = new Map(attendance.map((a) => [`${a.event_id}:${a.club_staff_id}`, a.status]));
  const people = members.map((member) => ({ member, counts: emptyCounts(), events: 0, rate: null as number | null }));
  const total = emptyCounts();
  const eventRows = [...events].sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)).map((event) => {
    const completed = Date.parse(event.end_at) <= now;
    const counts = emptyCounts();
    if (completed) {
      for (const person of people) {
        if (person.member.club_id !== event.club_id) continue;
        const saved = recorded.get(`${event.id}:${person.member.id}`);
        // Do not invent absences for people registered after an event.
        if (!saved && Date.parse(person.member.created_at) > Date.parse(event.start_at)) continue;
        const status = saved ?? "unmarked";
        counts[status]++;
        person.counts[status]++;
        person.events++;
        total[status]++;
      }
    }
    return { event, completed, counts, rate: attendanceRate(counts) };
  });
  for (const person of people) person.rate = attendanceRate(person.counts);
  const completed = eventRows.filter((r) => r.completed);
  const expected = Object.values(total).reduce((a, b) => a + b, 0);
  const marked = expected - total.unmarked;
  return {
    total, people, eventRows, expected, marked,
    rate: attendanceRate(total),
    completed: completed.length,
    upcoming: eventRows.length - completed.length,
    trainingCount: completed.filter((r) => ["gym_prep", "fitness_prep"].includes(r.event.event_type)).length,
    trainingHours: completed.filter((r) => ["gym_prep", "fitness_prep"].includes(r.event.event_type))
      .reduce((sum, r) => sum + Math.max(0, Date.parse(r.event.end_at) - Date.parse(r.event.start_at)) / 3600000, 0),
  };
}
