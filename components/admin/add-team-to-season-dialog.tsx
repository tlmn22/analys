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
import { Input } from "@/components/ui/input";
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
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const filteredTeams = availableTeams.filter((team) =>
    team.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedTeam = availableTeams.find((team) => team.id === selectedId);
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionState, formData: FormData) => {
      const result = await addTeamToSeason(seasonId, prevState, formData);
      if (result.success) setOpen(false);
      return result;
    },
    initialState
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setSearch("");
        setSelectedId("");
      }
    }}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Улиралд баг нэмэх</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="season-team-search">Баг хайх</Label>
            <Input
              id="season-team-search"
              type="search"
              placeholder="Багийн нэрээр хайх..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <input type="hidden" name="team_id" value={selectedTeam?.id ?? ""} />
            <div role="group" aria-label="Баг сонгох" className="max-h-64 overflow-y-auto rounded-lg border p-1">
              {filteredTeams.map((team) => (
                <Button
                  key={team.id}
                  type="button"
                  variant={selectedId === team.id ? "secondary" : "ghost"}
                  aria-pressed={selectedId === team.id}
                  className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                  disabled={pending}
                  onClick={() => setSelectedId(team.id)}
                >
                  {team.name}
                </Button>
              ))}
              {filteredTeams.length === 0 && (
                <p role="status" className="p-3 text-sm text-muted-foreground">
                  {availableTeams.length === 0 ? "Нэмэх боломжтой баг байхгүй байна." : "Хайлтад тохирох баг олдсонгүй."}
                </p>
              )}
            </div>
            {selectedTeam && <p className="text-sm text-muted-foreground">Сонгосон баг: {selectedTeam.name}</p>}
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || !selectedTeam}>
              {pending ? "Нэмж байна..." : "Нэмэх"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
