import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Season } from "@/lib/types";
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
import { SeasonFormDialog } from "@/components/admin/season-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteSeason } from "./actions";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function SeasonsPage() {
  const { data: seasons, error } = await supabaseAdmin()
    .from("seasons")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Season[]>();

  if (error) {
    return <p className="text-sm text-destructive">Алдаа: {error.message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Улирлууд</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {seasons?.length ?? 0} улирал бүртгэгдсэн
          </p>
        </div>
        <SeasonFormDialog
          trigger={
            <Button>
              <PlusIcon />
              Улирал нэмэх
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Нэр</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-24 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Улирал бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {seasons?.map((season) => (
              <TableRow key={season.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/seasons/${season.id}`}
                    className="hover:underline"
                  >
                    {season.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={season.status === "active" ? "default" : "secondary"}>
                    {season.status === "active" ? "Идэвхтэй" : "Идэвхгүй"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <SeasonFormDialog
                      season={season}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon />
                          <span className="sr-only">Засах</span>
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deleteSeason.bind(null, season.id)}
                      confirmText={`"${season.name}" улирлыг устгах уу?`}
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
