import { supabaseAdmin } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayerFormDialog } from "@/components/admin/player-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deletePlayer } from "./actions";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function PlayersPage() {
  const { data: players, error } = await supabaseAdmin()
    .from("players")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Player[]>();

  if (error) {
    return <p className="text-sm text-destructive">Алдаа: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Тоглогчид</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {players?.length ?? 0} тоглогч бүртгэгдсэн. Багийн бүрэлдэхүүн
            (roster) улирал тус бүрээр тохируулагдана.
          </p>
        </div>
        <PlayerFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Тоглогч нэмэх
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Photo</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Тоглогч бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {players?.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  {player.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.photo_url}
                      alt={`${player.first_name} ${player.last_name}`}
                      className="size-9 rounded-full border object-cover"
                    />
                  ) : (
                    <div className="size-9 rounded-full border bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {player.first_name} {player.last_name}
                </TableCell>
                <TableCell>{player.position}</TableCell>
                <TableCell>
                  <Badge variant={player.active ? "default" : "secondary"}>
                    {player.active ? "Тийм" : "Үгүй"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <PlayerFormDialog
                      player={player}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon />
                          <span className="sr-only">Засах</span>
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deletePlayer.bind(null, player.id)}
                      confirmText={`"${player.first_name} ${player.last_name}"-г устгах уу?`}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
