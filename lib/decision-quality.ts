import { OFFENSE } from "./tag-events";

export type DecisionQuality = "good" | "bad" | null;
const eligible = new Set(OFFENSE.filter(event => event.needsPlayer).map(event => event.type));
export function supportsDecisionQuality(eventType: string): boolean {
  return eligible.has(eventType);
}
export function normalizeDecisionQuality(eventType: string, playerId: string | null, value: unknown): DecisionQuality {
  return playerId && supportsDecisionQuality(eventType) && (value === "good" || value === "bad") ? value : null;
}

export function summarizeDecisions(events: { id: string; event_type: string; player_id: string | null; team_id: string | null; decision_quality?: string | null }[]) {
  const players = new Map<string, { playerId: string; teamId: string; good: number; bad: number; ungraded: number; percentage: number | null }>();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id) || !event.player_id || !event.team_id || !supportsDecisionQuality(event.event_type)) continue;
    seen.add(event.id);
    const key = `${event.team_id}:${event.player_id}`;
    const row = players.get(key) ?? { playerId: event.player_id, teamId: event.team_id, good: 0, bad: 0, ungraded: 0, percentage: null };
    if (event.decision_quality === "good") row.good++;
    else if (event.decision_quality === "bad") row.bad++;
    else row.ungraded++;
    row.percentage = row.good + row.bad ? row.good / (row.good + row.bad) * 100 : null;
    players.set(key, row);
  }
  return [...players.values()];
}
