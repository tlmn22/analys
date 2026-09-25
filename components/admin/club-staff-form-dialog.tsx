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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClubStaff, updateClubStaff, type ActionState } from "@/app/admin/(dashboard)/club-staff/actions";
import type { Club, ClubStaffRole, ClubStaffWithClub } from "@/lib/types";

export const ROLE_LABELS: Record<ClubStaffRole, string> = {
  owner: "Эзэмшигч",
  manager: "Менежер",
  head_coach: "Ахлах дасгалжуулагч",
  assistant_coach: "Туслах дасгалжуулагч",
  player: "Тоглогч",
};

const ROLE_OPTIONS: ClubStaffRole[] = [
  "owner",
  "manager",
  "head_coach",
  "assistant_coach",
  "player",
];

const initialState: ActionState = {};

export function ClubStaffFormDialog({
  clubs,
  staff,
  trigger,
}: {
  clubs: Pick<Club, "id" | "name">[];
  staff?: ClubStaffWithClub;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = staff
        ? await updateClubStaff(staff.id, prevState, formData)
        : await createClubStaff(prevState, formData);
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
          <DialogTitle>{staff ? "Ажилтан засах" : "Шинэ ажилтан бүртгэх"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="club_id">Клуб</Label>
            <Select
              name="club_id"
              defaultValue={staff?.club_id ?? clubs[0]?.id}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">Нэр</Label>
              <Input id="first_name" name="first_name" defaultValue={staff?.first_name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Овог</Label>
              <Input id="last_name" name="last_name" defaultValue={staff?.last_name} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={staff?.email} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Нууц үг</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required={!staff}
              placeholder={staff ? "Хоосон орхивол одоогийн нууц үг хэвээр үлдэнэ" : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Эрх</Label>
            <Select
              name="role"
              defaultValue={staff?.role ?? "assistant_coach"}
              items={ROLE_OPTIONS.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue placeholder="Эрх сонгох" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
