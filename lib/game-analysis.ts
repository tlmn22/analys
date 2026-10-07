// Stored shape of a game's expert analysis (game_analyses.content, JSON).
// Only the written part is stored, in both languages; scores, period scores
// and Four Factors are computed from the tags when the card renders.

export type AnalysisLang = "mn" | "en";
export type BiText = { mn: string; en: string };
export type Verdict = "good" | "bad" | "neutral";

export interface AnalysisDoc {
  version: 2;
  summary: BiText;
  deciders: { title: BiText; text: BiText; playerId?: string }[];
  teamSections: { teamId: string; offense: BiText[]; defense: BiText[] }[];
  players: { playerId: string; verdict: Verdict; text: BiText }[];
  keys: { title: BiText; items: BiText[] }[];
  caveats: BiText[];
}

const isBi = (v: unknown): v is BiText =>
  !!v && typeof v === "object" && typeof (v as BiText).mn === "string" && typeof (v as BiText).en === "string";
const isBiList = (v: unknown): v is BiText[] => Array.isArray(v) && v.every(isBi);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** Validates stored content; returns problems found (empty = valid). */
export function analysisProblems(value: unknown): string[] {
  const problems: string[] = [];
  const doc = value as Partial<AnalysisDoc> | null;
  if (!doc || typeof doc !== "object" || doc.version !== 2) return ["version must be 2"];
  if (!isBi(doc.summary)) problems.push("summary");
  if (!Array.isArray(doc.deciders) || !doc.deciders.every((d) => isBi(d?.title) && isBi(d?.text) && (d.playerId === undefined || isId(d.playerId))))
    problems.push("deciders");
  if (!Array.isArray(doc.teamSections) || !doc.teamSections.every((s) => isId(s?.teamId) && isBiList(s.offense) && isBiList(s.defense)))
    problems.push("teamSections");
  if (!Array.isArray(doc.players) || !doc.players.every((p) => isId(p?.playerId) && ["good", "bad", "neutral"].includes(p.verdict) && isBi(p.text)))
    problems.push("players");
  if (!Array.isArray(doc.keys) || !doc.keys.every((k) => isBi(k?.title) && isBiList(k.items))) problems.push("keys");
  if (!isBiList(doc.caveats)) problems.push("caveats");
  return problems;
}

export function parseAnalysis(content: string): AnalysisDoc | null {
  try {
    const value: unknown = JSON.parse(content);
    return analysisProblems(value).length ? null : (value as AnalysisDoc);
  } catch {
    return null;
  }
}
