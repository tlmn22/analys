import Link from "next/link";
import type { ReactNode } from "react";
import { REPORT_CATEGORIES } from "@/lib/report-categories";
import type { ReportHeaderInfo } from "./shared-data";

/** Shared title block + report-category nav row, reused by the Reports hub
 * and every individual report page. `activeSlug` bolds the current tab
 * (matching the reference tool); pass null on the hub itself, where no tab
 * is "current". */
export function ReportHeader({
  gameId,
  icon,
  title,
  activeSlug,
  info,
}: {
  gameId: string;
  icon: ReactNode;
  title: string;
  activeSlug: string | null;
  info: ReportHeaderInfo;
}) {
  const { game, homeTeamName, visitorTeamName, homeScore, visitorScore } = info;

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        {icon}
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {homeTeamName} <span className="font-semibold text-foreground">({homeScore})</span> vs.{" "}
        {visitorTeamName} <span className="font-semibold text-foreground">({visitorScore})</span>
        {game.game_date && <> · {new Date(game.game_date).toLocaleString("mn-MN")}</>}
        {game.location && <> @ {game.location}</>}
      </p>
      <p className="font-mono text-xs text-muted-foreground">Game ID {gameId}</p>

      <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 border-y border-border py-3 text-sm">
        {REPORT_CATEGORIES.map((c, i) => (
          <span key={c.slug} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">|</span>}
            {c.slug === activeSlug ? (
              <span className="font-semibold text-foreground">{c.label}</span>
            ) : (
              <Link
                href={`/admin/tag/${gameId}/reports/${c.slug}`}
                className="font-medium text-blue-500 hover:underline"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}
