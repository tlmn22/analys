"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAttendance, saveEventDescription, type ActionState } from "@/app/admin/(dashboard)/club-events/[eventId]/attendance/actions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AttendanceStatus, ClubStaffRole } from "@/lib/types";

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Ирсэн",
  absent: "Тасалсан",
  late: "Хоцорсон",
  excused: "Чөлөөтэй",
  sick: "Өвчтэй",
};

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["present", "absent", "late", "excused", "sick"];

export const ROLE_LABELS: Record<ClubStaffRole, string> = {
  owner: "Эзэмшигч",
  manager: "Менежер",
  head_coach: "Ахлах дасгалжуулагч",
  assistant_coach: "Туслах дасгалжуулагч",
  player: "Тоглогч",
};

export interface AttendanceRow {
  staffId: string;
  name: string;
  role: ClubStaffRole;
  status: AttendanceStatus | null;
}

const initialState: ActionState = {};

export function ClubEventAttendanceForm({ eventId, rows, description }: { eventId: string; rows: AttendanceRow[]; description: string }) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | null>>(
    () => Object.fromEntries(rows.map((r) => [r.staffId, r.status]))
  );
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await saveAttendance(eventId, prevState, formData);
      if (result.success) setAttendanceDirty(false);
      return result;
    },
    initialState
  );
  const [descriptionState, descriptionAction, descriptionPending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await saveEventDescription(eventId, prevState, formData);
      if (result.success) setDescriptionDirty(false);
      return result;
    }, initialState
  );

  return (
    <div className="flex flex-col gap-8">
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ирц бүртгэх</h2>
      <p className="text-sm text-muted-foreground">Клубын тоглогч, ажилтан бүрийн ирцийг сонгоно уу. Сонгоогүй хүнийг тасалсанд тооцохгүй.</p>
      <div className="flex flex-wrap gap-3 text-sm" aria-live="polite">
        {ATTENDANCE_OPTIONS.map((status) => <span key={status}>{ATTENDANCE_LABELS[status]}: {Object.values(statuses).filter((s) => s === status).length}</span>)}
        <span className="text-muted-foreground">Бөглөөгүй: {Object.values(statuses).filter((s) => !s).length}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Нэр</th>
              <th className="px-3 py-2 font-medium">Эрх</th>
              <th className="w-48 px-3 py-2 font-medium">Ирц</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  Энэ клубт тоглогч, ажилтан бүртгэгдээгүй байна
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.staffId} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{ROLE_LABELS[row.role]}</td>
                <td className="px-3 py-2">
                  <Select
                    name={`status__${row.staffId}`}
                    value={statuses[row.staffId]}
                    disabled={pending}
                    onValueChange={(value) => { setStatuses((prev) => ({ ...prev, [row.staffId]: value })); setAttendanceDirty(true); }}
                    items={ATTENDANCE_OPTIONS.map((s) => ({ value: s, label: ATTENDANCE_LABELS[s] }))}
                  >
                    <SelectTrigger className="w-full" aria-label={`${row.name} — ирц`}>
                      <SelectValue placeholder="Бөглөөгүй" />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ATTENDANCE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && !attendanceDirty && <p role="status" className="text-sm text-green-600">Ирц хадгалагдлаа.</p>}

      {rows.length > 0 && (
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Хадгалж байна..." : "Ирц хадгалах"}
        </Button>
      )}
    </form>
    <form action={descriptionAction} className="flex max-w-3xl flex-col gap-3">
      <Label htmlFor="event-description">Эвентийн тайлбар</Label>
      <Textarea id="event-description" name="description" defaultValue={description} rows={5}
        disabled={descriptionPending} onChange={() => setDescriptionDirty(true)}
        placeholder="Бэлтгэл, уулзалтын явц болон нэмэлт тэмдэглэл..." />
      {descriptionState.error && <p role="alert" className="text-sm text-destructive">{descriptionState.error}</p>}
      {descriptionState.success && !descriptionDirty && <p role="status" className="text-sm text-green-600">Тайлбар хадгалагдлаа.</p>}
      <Button type="submit" disabled={descriptionPending} className="self-start">
        {descriptionPending ? "Хадгалж байна..." : "Тайлбар хадгалах"}
      </Button>
    </form>
    </div>
  );
}
