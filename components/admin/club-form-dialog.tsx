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
import { createClub, updateClub, type ActionState } from "@/app/admin/(dashboard)/clubs/actions";
import type { Club } from "@/lib/types";

const initialState: ActionState = {};

export function ClubFormDialog({
  club,
  trigger,
}: {
  club?: Club;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = club
        ? await updateClub(club.id, prevState, formData)
        : await createClub(prevState, formData);
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
          <DialogTitle>{club ? "Клуб засах" : "Шинэ клуб бүртгэх"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Нэр</Label>
            <Input id="name" name="name" defaultValue={club?.name} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="logo">Logo</Label>
            {club?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={club.logo_url}
                alt={club.name}
                className="size-12 rounded-md border object-cover"
              />
            )}
            <Input id="logo" name="logo" type="file" accept="image/*" />
            {club && (
              <p className="text-xs text-muted-foreground">
                Хоосон орхивол одоогийн logo хэвээр үлдэнэ
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sponsor_name">Спонсорын нэр</Label>
            <Input
              id="sponsor_name"
              name="sponsor_name"
              defaultValue={club?.sponsor_name ?? ""}
              placeholder="Спонсор байхгүй бол хоосон орхино"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sponsor_logo">Спонсорын Logo</Label>
            {club?.sponsor_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={club.sponsor_logo_url}
                alt={club.sponsor_name ?? "Sponsor"}
                className="size-12 rounded-md border object-cover"
              />
            )}
            <Input id="sponsor_logo" name="sponsor_logo" type="file" accept="image/*" />
            {club && (
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
