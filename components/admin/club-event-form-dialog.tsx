"use client";

import { useActionState, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClubEvent, updateClubEvent, type ActionState } from "@/app/admin/(dashboard)/club-events/actions";
import type { Club, ClubEvent, ClubEventType } from "@/lib/types";

export const EVENT_TYPE_LABELS: Record<ClubEventType, string> = {
  gym_prep: "Заалны бэлтгэл",
  fitness_prep: "Фитнесс бэлтгэл",
  team_meeting: "Багийн уулзалт",
  other: "Бусад",
};

const EVENT_TYPE_OPTIONS: ClubEventType[] = ["gym_prep", "fitness_prep", "team_meeting", "other"];

const initialState: ActionState = {};

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return undefined;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function ClubEventFormDialog({
  clubs,
  event,
  trigger,
}: {
  clubs: Pick<Club, "id" | "name">[];
  event?: ClubEvent;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = event
        ? await updateClubEvent(event.id, prevState, formData)
        : await createClubEvent(prevState, formData);
      if (result.success) setOpen(false);
      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Эвент засах" : "Шинэ эвент зарлах"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="club_id">Клуб</Label>
            <Select
              name="club_id"
              defaultValue={event?.club_id ?? clubs[0]?.id}
              items={clubs.map((c) => ({ value: c.id, label: c.name }))}
            >
              <SelectTrigger id="club_id" className="w-full">
                <SelectValue placeholder="Клуб сонгох" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Нэр</Label>
            <Input id="name" name="name" defaultValue={event?.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event_type">Төрөл</Label>
            <Select
              name="event_type"
              defaultValue={event?.event_type ?? "team_meeting"}
              items={EVENT_TYPE_OPTIONS.map((t) => ({ value: t, label: EVENT_TYPE_LABELS[t] }))}
            >
              <SelectTrigger id="event_type" className="w-full">
                <SelectValue placeholder="Төрөл сонгох" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Байршил</Label>
            <Input id="location" name="location" defaultValue={event?.location ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_at">Эхлэх огноо</Label>
              <Input
                id="start_at"
                name="start_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(event?.start_at)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_at">Дуусах огноо</Label>
              <Input
                id="end_at"
                name="end_at"
                type="datetime-local"
                defaultValue={toLocalInputValue(event?.end_at)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Дэлгэрэнгүй тайлбар</Label>
            <Textarea id="description" name="description" defaultValue={event?.description ?? ""} rows={3} />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Хадгалж байна..." : "Хадгалах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
