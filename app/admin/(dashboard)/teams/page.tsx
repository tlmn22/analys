import { supabaseAdmin } from "@/lib/supabase/server";
import type { Team } from "@/lib/types";
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
import { TeamFormDialog } from "@/components/admin/team-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteTeam } from "./actions";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function TeamsPage() {
  const { data: teams, error } = await supabaseAdmin()
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Team[]>();

  if (error) {
    return <p className="text-sm text-destructive">Алдаа: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Багууд</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {teams?.length ?? 0} баг бүртгэгдсэн
          </p>
        </div>
        <TeamFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Баг нэмэх
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Logo</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Хүйс</TableHead>
              <TableHead className="w-24 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Баг бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {teams?.map((team) => (
              <TableRow key={team.id}>
                <TableCell>
                  {team.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="size-9 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="size-9 rounded-md border bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {team.gender === "male" ? "Эрэгтэй" : "Эмэгтэй"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <TeamFormDialog
                      team={team}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon />
                          <span className="sr-only">Засах</span>
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deleteTeam.bind(null, team.id)}
                      confirmText={`"${team.name}" багийг устгах уу?`}
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
