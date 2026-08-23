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
import {
  createSeason,
  updateSeason,
  type ActionState,
} from "@/app/admin/(dashboard)/seasons/actions";
import type { Season } from "@/lib/types";

const initialState: ActionState = {};

export function SeasonFormDialog({
  season,
  trigger,
}: {
  season?: Season;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = season
        ? await updateSeason(season.id, prevState, formData)
        : await createSeason(prevState, formData);
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
          <DialogTitle>
            {season ? "Улирал засах" : "Шинэ улирал бүртгэх"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Нэр</Label>
            <Input
              id="name"
              name="name"
              defaultValue={season?.name}
              placeholder="2025-2026 улирал"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Төлөв</Label>
            <Select
              name="status"
              defaultValue={season?.status ?? "active"}
              items={[
                { value: "active", label: "Идэвхтэй" },
                { value: "inactive", label: "Идэвхгүй" },
              ]}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Төлөв сонгох" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Идэвхтэй</SelectItem>
                <SelectItem value="inactive">Идэвхгүй</SelectItem>
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
