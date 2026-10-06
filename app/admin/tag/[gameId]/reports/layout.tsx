import { notFound } from "next/navigation";
import { reportAccess } from "@/lib/scouting-access";
import { ReportActivityTracker } from "@/components/admin/report-activity-tracker";
import { ReportPermissions } from "./report-permissions";

export default async function ReportsLayout({ params, children }: {
  params: Promise<{ gameId: string }>; children: React.ReactNode;
}) {
  const { gameId } = await params;
  const editor = await reportAccess(gameId);
  if (!editor) notFound();
  return <ReportPermissions readOnly={editor.role !== "superadmin"}>
    {editor.role === "club_staff" && <ReportActivityTracker />}
    {children}
  </ReportPermissions>;
}
