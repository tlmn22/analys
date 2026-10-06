// Shared shape + validation for report activity logging (see
// components/admin/report-activity-tracker.tsx and app/api/report-activity).

export type ReportActivityAction = "view" | "click" | "leave";

export interface ReportActivityEvent {
  viewId: string;
  slug: string;
  action: ReportActivityAction;
  target?: string | null;
  durationSeconds?: number | null;
  /** Client clock (ms) — batches are flushed every few seconds. */
  at: number;
}

export interface ReportActivityBatch {
  gameId: string;
  events: ReportActivityEvent[];
}

export const MAX_ACTIVITY_BATCH = 50;
export const MAX_TARGET_LENGTH = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{0,60}$/;
const ACTIONS = new Set(["view", "click", "leave"]);
// Accept client timestamps up to an hour old (tab asleep, slow flush), never in the future.
const MAX_AGE_MS = 60 * 60 * 1000;

export interface ReportActivityRow {
  view_id: string;
  game_id: string;
  report_slug: string;
  action: ReportActivityAction;
  target: string | null;
  duration_seconds: number | null;
  created_at: string;
}

/** Validates an untrusted batch; returns DB rows (minus staff_id) or null. */
export function parseActivityBatch(body: unknown, now: number): ReportActivityRow[] | null {
  if (!body || typeof body !== "object") return null;
  const { gameId, events } = body as Partial<ReportActivityBatch>;
  if (typeof gameId !== "string" || !UUID.test(gameId)) return null;
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_ACTIVITY_BATCH) return null;
  const rows: ReportActivityRow[] = [];
  for (const e of events) {
    if (!e || typeof e !== "object") return null;
    const { viewId, slug, action, target, durationSeconds, at } = e as ReportActivityEvent;
    if (typeof viewId !== "string" || !UUID.test(viewId)) return null;
    if (typeof slug !== "string" || !SLUG.test(slug)) return null;
    if (typeof action !== "string" || !ACTIONS.has(action)) return null;
    if (typeof at !== "number" || !Number.isFinite(at)) return null;
    const cleanTarget = typeof target === "string" ? target.replace(/\s+/g, " ").trim().slice(0, MAX_TARGET_LENGTH) : "";
    let duration: number | null = null;
    if (action === "leave") {
      if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds)) return null;
      duration = Math.min(86400, Math.max(0, Math.round(durationSeconds)));
    }
    rows.push({
      view_id: viewId,
      game_id: gameId,
      report_slug: slug,
      action: action as ReportActivityAction,
      target: action === "click" ? cleanTarget || null : null,
      duration_seconds: duration,
      created_at: new Date(Math.min(now, Math.max(now - MAX_AGE_MS, at))).toISOString(),
    });
  }
  return rows;
}

/** "/admin/tag/<gameId>/reports/<slug>" -> { gameId, slug } ("" for the hub). */
export function parseReportPath(pathname: string): { gameId: string; slug: string } | null {
  const m = pathname.match(/^\/admin\/tag\/([^/]+)\/reports(?:\/([^/]+))?\/?$/);
  if (!m || !UUID.test(m[1])) return null;
  const slug = m[2] ?? "";
  return SLUG.test(slug) ? { gameId: m[1], slug } : null;
}

export interface StoredActivity {
  staff_id: string;
  game_id: string;
  report_slug: string;
  action: ReportActivityAction;
  duration_seconds: number | null;
  created_at: string;
}

export interface ActivitySummaryRow {
  staffId: string;
  gameId: string;
  slug: string;
  views: number;
  seconds: number;
  clicks: number;
  lastAt: string;
}

/** One row per person × game × report, most recent first. */
export function summarizeActivity(rows: StoredActivity[]): ActivitySummaryRow[] {
  const byKey = new Map<string, ActivitySummaryRow>();
  for (const r of rows) {
    const key = `${r.staff_id}|${r.game_id}|${r.report_slug}`;
    const entry = byKey.get(key) ?? { staffId: r.staff_id, gameId: r.game_id, slug: r.report_slug, views: 0, seconds: 0, clicks: 0, lastAt: "" };
    if (r.action === "view") entry.views++;
    else if (r.action === "click") entry.clicks++;
    else entry.seconds += r.duration_seconds ?? 0;
    if (r.created_at > entry.lastAt) entry.lastAt = r.created_at;
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
