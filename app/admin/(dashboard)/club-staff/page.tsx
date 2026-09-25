import { supabaseAdmin } from "@/lib/supabase/server";
import type { Club, ClubStaffWithClub } from "@/lib/types";
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
import { ClubStaffFormDialog, ROLE_LABELS } from "@/components/admin/club-staff-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteClubStaff } from "./actions";
import { PlusIcon, PencilIcon } from "lucide-react";

export default async function ClubStaffPage() {
  const db = supabaseAdmin();

  const [staffRes, clubsRes] = await Promise.all([
    db
      .from("club_staff")
      .select("id, club_id, first_name, last_name, email, role, created_at, club:clubs(id, name)")
      .order("created_at", { ascending: false })
      .returns<ClubStaffWithClub[]>(),
    db.from("clubs").select("id, name").order("name").returns<Pick<Club, "id" | "name">[]>(),
  ]);

  if (staffRes.error) {
    return <p className="text-sm text-destructive">Алдаа: {staffRes.error.message}</p>;
  }

  const staff = staffRes.data ?? [];
  const clubs = clubsRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Клубын ажилтнууд</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {staff.length} ажилтан бүртгэгдсэн — owner/manager/head coach/assistant coach.
            Нэвтрэх эрхийн логик дараа хийгдэнэ, энд зөвхөн бүртгэл.
          </p>
        </div>
        <ClubStaffFormDialog
          clubs={clubs}
          trigger={
            <Button disabled={clubs.length === 0}>
              <PlusIcon />
              Ажилтан нэмэх
            </Button>
          }
        />
      </div>

      {clubs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Эхлээд дор хаяж нэг клуб бүртгэнэ үү (Клубууд хэсэгт).
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Нэр</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Клуб</TableHead>
              <TableHead>Эрх</TableHead>
              <TableHead className="w-24 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Ажилтан бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.first_name} {s.last_name}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell>{s.club?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[s.role]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <ClubStaffFormDialog
                      clubs={clubs}
                      staff={s}
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <PencilIcon />
                          <span className="sr-only">Засах</span>
                        </Button>
                      }
                    />
                    <DeleteButton
                      action={deleteClubStaff.bind(null, s.id)}
                      confirmText={`"${s.first_name} ${s.last_name}"-ийг устгах уу?`}
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
