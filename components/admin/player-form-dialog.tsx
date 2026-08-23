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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPlayer,
  updatePlayer,
  type ActionState,
} from "@/app/admin/(dashboard)/players/actions";
import { POSITIONS, type Player } from "@/lib/types";

const initialState: ActionState = {};

export function PlayerFormDialog({
  player,
  trigger,
}: {
  player?: Player;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = player
        ? await updatePlayer(player.id, prevState, formData)
        : await createPlayer(prevState, formData);
      if (result.success) setOpen(false);
      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {player ? "Тоглогч засах" : "Шинэ тоглогч бүртгэх"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first_name">Нэр</Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={player?.first_name}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="last_name">Овог</Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={player?.last_name}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="position">Position</Label>
            <Select
              name="position"
              defaultValue={player?.position ?? "PG"}
              items={POSITIONS}
            >
              <SelectTrigger id="position" className="w-full">
                <SelectValue placeholder="Position" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photo">Photo</Label>
            {player?.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={player.photo_url}
                alt={`${player.first_name} ${player.last_name}`}
                className="size-12 rounded-full border object-cover"
              />
            )}
            <Input id="photo" name="photo" type="file" accept="image/*" />
            {player && (
              <p className="text-xs text-muted-foreground">
                Хоосон орхивол одоогийн зураг хэвээр үлдэнэ
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="active"
              name="active"
              defaultChecked={player?.active ?? true}
            />
            <Label htmlFor="active">Active</Label>
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
