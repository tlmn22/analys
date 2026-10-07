// Report pages anyone can open without logging in. Only each listed game's
// Scouting Report is public; every other /admin page still needs a session.
// No server-only imports: proxy.ts uses this too.

export const PUBLIC_SCOUTING_REPORT_GAME_IDS = new Set([
  "6cd94b4e-6ee9-40a9-8660-a13fe63627b7", // Сэлэнгэ Бодонс vs Darkhan United, 2026-10-06
]);

export function isPublicReportPath(pathname: string): boolean {
  const m = pathname.match(/^\/admin\/tag\/([^/]+)\/reports\/scouting-report\/?$/);
  return !!m && PUBLIC_SCOUTING_REPORT_GAME_IDS.has(m[1]);
}
