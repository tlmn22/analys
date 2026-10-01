import Link from "next/link";
import { redirect } from "next/navigation";
import { getPackageRecipient } from "@/lib/package-recipient-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/admin/logout-button";
import { PlayerThemeToggle } from "./theme-toggle";
import { PlayerNav } from "./player-nav";

const roles: Record<string, string> = { player: "Тоглогч", owner: "Эзэмшигч", manager: "Менежер", head_coach: "Ахлах дасгалжуулагч", assistant_coach: "Туслах дасгалжуулагч" };
export async function PlayerShell({ children }: { children: React.ReactNode }) {
  const member = await getPackageRecipient();
  if (!member) redirect("/admin/login");
  const { data: club } = await supabaseAdmin().from("clubs").select("name").eq("id", member.club_id).maybeSingle();
  return <div className="min-h-screen bg-muted/20" style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}><div className="mx-auto max-w-6xl">
    <header className="flex items-center justify-between gap-3 px-4 py-5 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-lg font-semibold text-white" aria-hidden="true">{member.first_name.slice(0, 1)}</span><div className="min-w-0"><p className="truncate font-semibold">{member.first_name} {member.last_name}</p><p className="text-xs text-muted-foreground">{roles[member.role]} · {club?.name ?? "Клуб"}</p></div></div><div className="flex shrink-0 items-center gap-2"><PlayerThemeToggle /><LogoutButton /></div></header>
    {member.role !== "player" && <Link href="/admin/club-events" className="m-4 inline-block text-sm text-emerald-600">← Клубын удирдлага</Link>}
    {children}
    <PlayerNav />
  </div></div>;
}
