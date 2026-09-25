"use client";

import { useState, useTransition } from "react";
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
  Combobox,
  ComboboxInputGroup,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import {
  addPlayersToRoster,
  removeFromRoster,
  type ActionState,
} from "@/app/admin/(dashboard)/seasons/[id]/actions";
import type { Player, RosterWithPlayer } from "@/lib/types";
import { Trash2Icon } from "lucide-react";

type PlayerOption = Pick<Player, "id" | "first_name" | "last_name">;

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
  availablePlayers: PlayerOption[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlayerOption[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  const allNumbersFilled =
    selected.length > 0 && selected.every((p) => numbers[p.id]?.trim());

  function handleValueChange(value: PlayerOption[]) {
    setSelected(value);
    setNumbers((prev) => {
      const next: Record<string, string> = {};
      for (const p of value) next[p.id] = prev[p.id] ?? "";
      return next;
    });
  }

  function handleSubmit() {
    const entries = selected.map((p) => ({
      player_id: p.id,
      number: Number(numbers[p.id]),
    }));
    startTransition(async () => {
      const result = await addPlayersToRoster(seasonTeamId, seasonId, entries);
      setState(result);
      if (!result.error) {
        setSelected([]);
        setNumbers({});
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected([]);
          setNumbers({});
          setState({});
        }
      }}
    >
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

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roster-player-search">Тоглогч нэмэх (олноор хайж сонгоно)</Label>
            <Combobox
              items={availablePlayers}
              multiple
              value={selected}
              onValueChange={handleValueChange}
              itemToStringLabel={(p: PlayerOption) => `${p.first_name} ${p.last_name}`}
              isItemEqualToValue={(a: PlayerOption, b: PlayerOption) => a.id === b.id}
            >
              <ComboboxInputGroup>
                <ComboboxChips>
                  <ComboboxValue>
                    {(value: PlayerOption[]) => (
                      <>
                        {value.map((p) => (
                          <ComboboxChip key={p.id}>
                            {p.first_name} {p.last_name}
                            <ComboboxChipRemove aria-label={`${p.first_name} ${p.last_name} хасах`} />
                          </ComboboxChip>
                        ))}
                        <ComboboxInput
                          id="roster-player-search"
                          placeholder={value.length ? "" : "Нэрээр хайх..."}
                        />
                      </>
                    )}
                  </ComboboxValue>
                </ComboboxChips>
              </ComboboxInputGroup>
              <ComboboxContent>
                <ComboboxEmpty>Тоглогч олдсонгүй</ComboboxEmpty>
                <ComboboxList>
                  {(p: PlayerOption) => (
                    <ComboboxItem key={p.id} value={p}>
                      {p.first_name} {p.last_name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {selected.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm">
                    {p.first_name} {p.last_name}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Дугаар"
                    className="w-20"
                    value={numbers[p.id] ?? ""}
                    onChange={(e) =>
                      setNumbers((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <DialogFooter>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !allNumbersFilled}
            >
              {pending
                ? "Нэмж байна..."
                : `Roster-д нэмэх${selected.length > 0 ? ` (${selected.length})` : ""}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
