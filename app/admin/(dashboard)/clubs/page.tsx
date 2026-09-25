import { supabaseAdmin } from "@/lib/supabase/server";
import type { Club } from "@/lib/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ClubFormDialog } from "@/components/admin/club-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteClub } from "./actions";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function ClubsPage() {
  const { data: clubs, error } = await supabaseAdmin()
    .from("clubs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Club[]>();

  if (error) {
    return <p className="text-sm text-destructive">Алдаа: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Клубууд</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {clubs?.length ?? 0} клуб бүртгэгдсэн
          </p>
        </div>
        <ClubFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Клуб нэмэх
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
              <TableHead className="w-14">Спонсор</TableHead>
              <TableHead>Спонсорын нэр</TableHead>
              <TableHead className="w-24 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clubs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Клуб бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {clubs?.map((club) => (
              <TableRow key={club.id}>
                <TableCell>
                  {club.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="size-9 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="size-9 rounded-md border bg-muted" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{club.name}</TableCell>
                <TableCell>
                  {club.sponsor_logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={club.sponsor_logo_url}
                      alt={club.sponsor_name ?? "Sponsor"}
                      className="size-9 rounded-md border object-cover"
                    />
                  ) : (
                    <div className="size-9 rounded-md border bg-muted" />
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {club.sponsor_name || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <ClubFormDialog
                      club={club}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon />
                          <span className="sr-only">Засах</span>
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deleteClub.bind(null, club.id)}
                      confirmText={`"${club.name}" клубыг устгах уу?`}
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
