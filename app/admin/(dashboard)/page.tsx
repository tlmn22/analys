import { supabaseAdmin } from "@/lib/supabase/server";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ShieldIcon, UsersIcon, CalendarIcon } from "lucide-react";

export default async function DashboardPage() {
  const db = supabaseAdmin();
  const [teams, players, seasons] = await Promise.all([
    db.from("teams").select("*", { count: "exact", head: true }),
    db.from("players").select("*", { count: "exact", head: true }),
    db.from("seasons").select("*", { count: "exact", head: true }),
  ]);

  const queryError = teams.error || players.error || seasons.error;
  if (queryError) {
    return <p className="text-sm text-destructive">Алдаа: {queryError.message}</p>;
  }

  const stats = [
    { label: "Багууд", value: teams.count ?? 0, icon: ShieldIcon },
    { label: "Тоглогчид", value: players.count ?? 0, icon: UsersIcon },
    { label: "Улирлууд", value: seasons.count ?? 0, icon: CalendarIcon },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Хянах самбар</h1>
        <p className="text-sm text-muted-foreground">
          Basketball analytic system — Phase 1
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </div>
              <stat.icon className="size-8 text-muted-foreground" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
