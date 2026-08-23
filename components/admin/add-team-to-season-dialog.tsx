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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTeamToSeason,
  type ActionState,
} from "@/app/admin/(dashboard)/seasons/[id]/actions";
import type { Team } from "@/lib/types";

const initialState: ActionState = {};

export function AddTeamToSeasonDialog({
  seasonId,
  availableTeams,
  trigger,
}: {
  seasonId: string;
  availableTeams: Pick<Team, "id" | "name">[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await addTeamToSeason(seasonId, prevState, formData);
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
          <DialogTitle>Улиралд баг нэмэх</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team_id">Баг</Label>
            <Select
              name="team_id"
              defaultValue={availableTeams[0]?.id}
              items={availableTeams.map((t) => ({ value: t.id, label: t.name }))}
            >
              <SelectTrigger id="team_id" className="w-full">
                <SelectValue placeholder="Баг сонгох" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || availableTeams.length === 0}>
              {pending ? "Нэмж байна..." : "Нэмэх"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
