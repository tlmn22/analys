import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardListIcon } from "lucide-react";
import { getReportHeaderInfo } from "./shared-data";
import { ReportHeader } from "./report-header";
import { GameAnalysis } from "./game-analysis";

export const dynamic = "force-dynamic";

export default async function ReportsHubPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const info = await getReportHeaderInfo(gameId);
  if (!info) notFound();

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-[1600px]">
        <Link href="/admin/scouting-reports" className="text-sm text-blue-500 hover:underline">
          ← Scouting Reports
        </Link>
        <Link href="/admin/event-packages" className="ml-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600">
          Videos →
        </Link>
        <div className="mt-3">
          <ReportHeader
            gameId={gameId}
            icon={<ClipboardListIcon className="size-7" />}
            title="Reports"
            activeSlug={null}
            info={info}
          />
        </div>
        <div className="mt-6">
          <GameAnalysis gameId={gameId} />
        </div>
      </div>
    </div>
  );
}
