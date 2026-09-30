import Link from "next/link";
import { redirect } from "next/navigation";
import { getPackageRecipient } from "@/lib/package-recipient-access";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export default async function MyPackagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const member = await getPackageRecipient();
  if (!member) redirect("/admin/login");
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const { data, error, count } = await supabaseAdmin().from("event_package_assignments")
    .select("id,created_at,package:event_packages(id,name,description)", { count: "exact" }).eq("member_id", member.id)
    .order("created_at", { ascending: false }).order("id").range((page - 1) * 30, page * 30 - 1);
  const rows = (data ?? []) as unknown as { id: string; package: { id: string; name: string; description: string } | null }[];
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-5"><header><h1 className="text-2xl font-semibold">Бичлэг</h1><p className="mt-2 text-sm text-muted-foreground">Танд хуваарилсан scouting бичлэгүүд</p></header>
    {error ? <p role="alert">Багцуудыг ачаалж чадсангүй.</p> : <><div className="grid gap-4 sm:grid-cols-2">{rows.map(row => row.package && <Link key={row.id} href={`/my-packages/${row.package.id}`} className="rounded-xl border p-5 hover:border-emerald-600"><h2 className="font-semibold">{row.package.name}</h2><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{row.package.description}</p></Link>)}</div>{!rows.length && <p className="p-8 text-center text-muted-foreground">Одоогоор танд багц хуваарилаагүй байна.</p>}<div className="flex justify-between">{page > 1 ? <Link href={`?page=${page - 1}`}>← Өмнөх</Link> : <span />}{page * 30 < (count ?? 0) && <Link href={`?page=${page + 1}`}>Дараах →</Link>}</div></>}
  </main>;
}
