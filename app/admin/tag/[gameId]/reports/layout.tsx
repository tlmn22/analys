import { notFound } from "next/navigation";
import { reportAccess } from "@/lib/scouting-access";
import { ReportPermissions } from "./report-permissions";

export default async function ReportsLayout({ params, children }: {
  params: Promise<{ gameId: string }>; children: React.ReactNode;
}) {
  const { gameId } = await params;
  const editor = await reportAccess(gameId);
  if (!editor) notFound();
  return <ReportPermissions readOnly={editor.role !== "superadmin"}>{children}</ReportPermissions>;
}
