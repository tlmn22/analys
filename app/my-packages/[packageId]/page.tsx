import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPackageRecipient, canViewAssignedPackage } from "@/lib/package-recipient-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PackageViewer, type PackageClip } from "@/components/admin/package-viewer";

export const dynamic = "force-dynamic";
export default async function AssignedPackagePage({ params, searchParams }: { params: Promise<{ packageId: string }>; searchParams: Promise<{ page?: string }> }) {
  const member = await getPackageRecipient();
  if (!member) redirect("/admin/login");
  const { packageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(packageId) || !(await canViewAssignedPackage(packageId, member.id))) notFound();
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const db = supabaseAdmin();
  const [pack, items] = await Promise.all([
    db.from("event_packages").select("name,description").eq("id", packageId).maybeSingle(),
    db.from("event_package_items").select("id,lead_seconds,trail_seconds,event:game_events(id,event_type,period,clock_time,video_time,game_id,game:games(video_url),player:players!game_events_player_id_fkey(first_name,last_name))", { count: "exact" })
      .eq("package_id", packageId).order("created_at").order("id").range((page - 1) * 100, page * 100 - 1),
  ]);
  if (pack.error || items.error) return <p role="alert" className="p-8">Багцыг ачаалж чадсангүй.</p>;
  if (!pack.data) notFound();
  return <main className="mx-auto w-full max-w-6xl space-y-5 p-5"><Link href="/my-packages" className="text-emerald-600">← Бичлэг</Link><h1 className="text-2xl font-semibold">{pack.data.name}</h1><p className="whitespace-pre-wrap text-sm text-muted-foreground">{pack.data.description}</p><PackageViewer key={`${packageId}:${page}`} clips={(items.data ?? []) as unknown as PackageClip[]} showReports={false} /><div className="flex justify-between">{page > 1 ? <Link href={`?page=${page - 1}`}>← Өмнөх 100</Link> : <span />}{page * 100 < (items.count ?? 0) && <Link href={`?page=${page + 1}`}>Дараах 100 →</Link>}</div></main>;
}
