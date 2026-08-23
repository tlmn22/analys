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
import { Separator } from "@/components/ui/separator";
import {
  addPlayerToRoster,
  removeFromRoster,
  type ActionState,
} from "@/app/admin/(dashboard)/seasons/[id]/actions";
import type { Player, RosterWithPlayer } from "@/lib/types";
import { Trash2Icon } from "lucide-react";

const initialState: ActionState = {};

export function RosterDialog({
  seasonTeamId,
  seasonId,
  teamName,
  roster,
  availablePlayers,
  trigger,
}: {
  seasonTeamId: string;
  seasonId: string;
  teamName: string;
  roster: RosterWithPlayer[];
  availablePlayers: Pick<Player, "id" | "first_name" | "last_name">[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    (prevState: ActionState, formData: FormData) =>
      addPlayerToRoster(seasonTeamId, seasonId, prevState, formData),
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{teamName} — Roster</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {roster.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Тоглогч бүртгэгдээгүй байна
            </p>
          )}
          {roster.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground">
                  #{entry.number}
                </span>
                <span>
                  {entry.player.first_name} {entry.player.last_name}
                </span>
              </div>
              <form action={removeFromRoster.bind(null, entry.id, seasonId)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2Icon />
                  <span className="sr-only">Хасах</span>
                </Button>
              </form>
            </div>
          ))}
        </div>

        <Separator />

        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="player_id">Тоглогч нэмэх</Label>
              <Select
                name="player_id"
                defaultValue={availablePlayers[0]?.id}
                items={availablePlayers.map((p) => ({
                  value: p.id,
                  label: `${p.first_name} ${p.last_name}`,
                }))}
              >
                <SelectTrigger id="player_id" className="w-full">
                  <SelectValue placeholder="Тоглогч сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="number">Дугаар</Label>
              <Input id="number" name="number" type="number" min={0} required />
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || availablePlayers.length === 0}
            >
              {pending ? "Нэмж байна..." : "Roster-д нэмэх"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
