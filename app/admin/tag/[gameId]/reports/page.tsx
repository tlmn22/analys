import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardListIcon } from "lucide-react";
import { getReportHeaderInfo } from "./shared-data";
import { ReportHeader } from "./report-header";

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
        <Link href={`/admin/tag/${gameId}`} className="text-sm text-blue-500 hover:underline">
          ← Tag руу буцах
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
      </div>
    </div>
  );
}
