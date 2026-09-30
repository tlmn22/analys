import { clubPackageIds } from "@/lib/club-package-access";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getEventEditor } from "@/lib/club-event-access";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PackageViewer, type PackageClip } from "@/components/admin/package-viewer";
import { loadPackageRecipients } from "@/app/admin/package-assignment-actions";
import { PackageAssignment } from "@/components/admin/package-assignment";

export default async function EventPackagePage({ params, searchParams }: {
  params: Promise<{ packageId: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  const isAdmin = editor.role === "superadmin";
  const { packageId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(packageId)) notFound();
  if (editor.role === "club_staff" && !(await clubPackageIds(editor.clubId)).includes(packageId)) notFound();
  const query = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(query.page) || 1)));
  const db = supabaseAdmin();
  const [pack, items] = await Promise.all([
    db.from("event_packages").select("id,name,description").eq("id", packageId).maybeSingle(),
    db.from("event_package_items").select("id,lead_seconds,trail_seconds,event:game_events(id,event_type,period,clock_time,video_time,game_id,game:games(video_url),player:players!game_events_player_id_fkey(first_name,last_name))", { count: "exact" })
      .eq("package_id", packageId).order("created_at").order("id").range((page - 1) * 100, page * 100 - 1),
  ]);
  if (pack.error || items.error) return <p role="alert" className="text-destructive">Багцыг ачаалж чадсангүй: {pack.error?.message ?? items.error?.message}</p>;
  if (!pack.data) notFound();
  const recipients = isAdmin ? await loadPackageRecipients(packageId) : null;
  const clips = (items.data ?? []) as unknown as PackageClip[];
  return <div className="space-y-5">
    <Link href="/admin/event-packages" className="text-sm text-emerald-600 hover:underline">← Бүх багц</Link>
    <header><h1 className="break-words text-2xl font-semibold">{pack.data.name}</h1><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{pack.data.description}</p><p className="mt-2 text-xs text-muted-foreground">{items.count ?? 0} event · Өөр өөр тоглолтын бичлэгүүдийг үзэх боломжтой</p></header>
    <PackageViewer key={`${packageId}:${page}`} clips={clips} showReports={isAdmin} membersPanel={recipients ? <PackageAssignment packageId={packageId} initialData={recipients.members ? recipients : undefined} initialError={recipients.error} /> : undefined} />
    <div className="flex justify-between text-sm">{page > 1 ? <Link href={`?page=${page - 1}`}>← Өмнөх 100</Link> : <span />}{page * 100 < (items.count ?? 0) && <Link href={`?page=${page + 1}`}>Дараах 100 →</Link>}</div>
  </div>;
}
