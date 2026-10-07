import { notFound } from "next/navigation";
import { reportAccess } from "@/lib/scouting-access";
import { PUBLIC_SCOUTING_REPORT_GAME_IDS } from "@/lib/public-reports";
import { ReportActivityTracker } from "@/components/admin/report-activity-tracker";
import { ReportPermissions } from "./report-permissions";

export default async function ReportsLayout({ params, children }: {
  params: Promise<{ gameId: string }>; children: React.ReactNode;
}) {
  const { gameId } = await params;
  const editor = await reportAccess(gameId);
  // Public games reach here only for their Scouting Report: proxy.ts sends
  // anonymous visitors of every other report page to the login screen.
  if (!editor && !PUBLIC_SCOUTING_REPORT_GAME_IDS.has(gameId)) notFound();
  return <ReportPermissions readOnly={editor?.role !== "superadmin"}>
    {editor?.role === "club_staff" && <ReportActivityTracker />}
    {children}
  </ReportPermissions>;
}
