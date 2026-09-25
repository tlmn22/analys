"use client";

import { useState } from "react";
import type { Club, ClubStaffWithClub } from "@/lib/types";
import { compareMemberNames } from "@/lib/club-attendance-report";
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
import { deleteClubStaff } from "@/app/admin/(dashboard)/club-staff/actions";
import { PlusIcon, PencilIcon } from "lucide-react";


type SortKey = "name" | "email" | "club" | "role";
const columns: { key: SortKey; label: string }[] = [
  { key: "name", label: "Нэр" }, { key: "email", label: "Email" },
  { key: "club", label: "Клуб" }, { key: "role", label: "Үүрэг" },
];

export function ClubStaffTable({ staff, clubs, isAdmin }: {
  staff: ClubStaffWithClub[]; clubs: Pick<Club, "id" | "name">[]; isAdmin: boolean;
}) {
  const [sort, setSort] = useState<SortKey>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const sortedStaff = [...staff].sort((a, b) => {
    const value = (person: ClubStaffWithClub) => sort === "email" ? person.email : sort === "club" ? person.club?.name ?? "" : ROLE_LABELS[person.role];
    const order = sort === "name" ? compareMemberNames(a, b) : compareMemberNames(
      { ...a, first_name: value(a), last_name: "", id: "" },
      { ...b, first_name: value(b), last_name: "", id: "" },
    );
    return (direction === "asc" ? order : -order) || compareMemberNames(a, b);
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Клубын ажилтнууд</h1>
          <p className="text-sm text-muted-foreground">
            Нийт {staff.length} гишүүн бүртгэгдсэн. {isAdmin ? "Бүх клубын гишүүд." : "Өөрийн клубын гишүүд."}
          </p>
        </div>
        {isAdmin && <ClubStaffFormDialog
          clubs={clubs}
          trigger={
            <Button disabled={clubs.length === 0}>
              <PlusIcon />
              Ажилтан нэмэх
            </Button>
          }
        />}
      </div>

      {isAdmin && clubs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Эхлээд дор хаяж нэг клуб бүртгэнэ үү (Клубууд хэсэгт).
        </p>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(column => <TableHead key={column.key} aria-sort={sort === column.key ? direction === "asc" ? "ascending" : "descending" : "none"}>
                <button type="button" className="inline-flex items-center gap-2 py-2 hover:text-foreground" onClick={() => { setSort(column.key); setDirection(sort === column.key && direction === "asc" ? "desc" : "asc"); }}>
                  {column.label}<span aria-hidden="true">{sort === column.key ? direction === "asc" ? "↑" : "↓" : "↕"}</span>
                </button>
              </TableHead>)}
              {isAdmin && <TableHead className="w-24 text-right">Үйлдэл</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  Ажилтан бүртгэгдээгүй байна
                </TableCell>
              </TableRow>
            )}
            {sortedStaff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.first_name} {s.last_name}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.email}</TableCell>
                <TableCell>{s.club?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={s.role === "player" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}>{ROLE_LABELS[s.role]}</Badge>
                </TableCell>
                {isAdmin && <TableCell>
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
                </TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
