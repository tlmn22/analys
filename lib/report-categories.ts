export interface ReportCategory {
  slug: string;
  label: string;
}

/** Report tabs shown on a game's Reports hub — each links to its own page
 * under reports/[slug], stubbed out ("Тун удахгүй нэмэгдэнэ") until its
 * exact formula/layout is specified. */
export const REPORT_CATEGORIES: ReportCategory[] = [
  { slug: "game-summary", label: "Game Summary" },
  { slug: "player-lineup-stats", label: "Player & Lineup Stats" },
  { slug: "shot-chart", label: "Shot Chart" },
  { slug: "coaching-stats", label: "Coaching Stats" },
  { slug: "player-impact", label: "Player Impact" },
  { slug: "shot-analysis", label: "Shot Analysis" },
  { slug: "hustle-contact", label: "Hustle & Contact" },
  { slug: "screens-pnr", label: "Screens & PnR" },
  { slug: "matchups", label: "Matchups" },
  { slug: "action-tags", label: "Action Tags" },
  { slug: "rebounding", label: "Rebounding" },
  { slug: "assist-map", label: "Assist Map" },
  { slug: "weighted", label: "Weighted" },
];
