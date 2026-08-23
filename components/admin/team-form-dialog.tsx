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
import { createTeam, updateTeam, type ActionState } from "@/app/admin/(dashboard)/teams/actions";
import type { Team } from "@/lib/types";

const initialState: ActionState = {};

export function TeamFormDialog({
  team,
  trigger,
}: {
  team?: Team;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = team
        ? await updateTeam(team.id, prevState, formData)
        : await createTeam(prevState, formData);
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
          <DialogTitle>{team ? "Баг засах" : "Шинэ баг бүртгэх"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Нэр</Label>
            <Input id="name" name="name" defaultValue={team?.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gender">Хүйс</Label>
            <Select
              name="gender"
              defaultValue={team?.gender ?? "male"}
              items={[
                { value: "male", label: "Эрэгтэй" },
                { value: "female", label: "Эмэгтэй" },
              ]}
            >
              <SelectTrigger id="gender" className="w-full">
                <SelectValue placeholder="Хүйс сонгох" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Эрэгтэй</SelectItem>
                <SelectItem value="female">Эмэгтэй</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logo">Logo</Label>
            {team?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logo_url}
                alt={team.name}
                className="size-12 rounded-md border object-cover"
              />
            )}
            <Input id="logo" name="logo" type="file" accept="image/*" />
            {team && (
              <p className="text-xs text-muted-foreground">
                Хоосон орхивол одоогийн logo хэвээр үлдэнэ
              </p>
            )}
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
