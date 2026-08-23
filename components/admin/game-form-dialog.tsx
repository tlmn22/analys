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
  createGame,
  updateGame,
  type ActionState,
} from "@/app/admin/(dashboard)/seasons/[id]/actions";
import { GAME_TYPES, type Game, type Team } from "@/lib/types";

const initialState: ActionState = {};

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return undefined;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function GameFormDialog({
  seasonId,
  teams,
  game,
  trigger,
}: {
  seasonId: string;
  teams: Pick<Team, "id" | "name">[];
  game?: Game;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = game
        ? await updateGame(game.id, seasonId, prevState, formData)
        : await createGame(seasonId, prevState, formData);
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
            {game ? "Тоглолт засах" : "Шинэ тоглолт үүсгэх"}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="home_team_id">Home team</Label>
              <Select
                name="home_team_id"
                defaultValue={game?.home_team_id ?? teams[0]?.id}
                items={teams.map((t) => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger id="home_team_id" className="w-full">
                  <SelectValue placeholder="Баг сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="home_team_color">Home Team Color</Label>
              <Input
                id="home_team_color"
                name="home_team_color"
                defaultValue={game?.home_team_color ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visitor_team_id">Visitor team</Label>
              <Select
                name="visitor_team_id"
                defaultValue={game?.visitor_team_id ?? teams[1]?.id ?? teams[0]?.id}
                items={teams.map((t) => ({ value: t.id, label: t.name }))}
              >
                <SelectTrigger id="visitor_team_id" className="w-full">
                  <SelectValue placeholder="Баг сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="visitor_team_color">Visitor Team Color</Label>
              <Input
                id="visitor_team_color"
                name="visitor_team_color"
                defaultValue={game?.visitor_team_color ?? ""}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" defaultValue={game?.location ?? ""} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="video_url">YouTube URL</Label>
            <Input
              id="video_url"
              name="video_url"
              placeholder="https://www.youtube.com/watch?v=..."
              defaultValue={game?.video_url ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Тоглолтыг тэмдэглэх (Tag) хуудсанд ашиглагдана
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="game_type">Game Type</Label>
              <Select
                name="game_type"
                defaultValue={game?.game_type ?? "league"}
                items={GAME_TYPES}
              >
                <SelectTrigger id="game_type" className="w-full">
                  <SelectValue placeholder="Төрөл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {GAME_TYPES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="game_date">Огноо, цаг</Label>
              <Input
                id="game_date"
                name="game_date"
                type="datetime-local"
                defaultValue={toLocalInputValue(game?.game_date)}
              />
            </div>
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || teams.length < 2}>
              {pending ? "Хадгалж байна..." : "Хадгалах"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
