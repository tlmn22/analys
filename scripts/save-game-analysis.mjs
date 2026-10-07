import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Saves (or replaces) a game's expert analysis from a JSON file in the
// bilingual shape defined in lib/game-analysis.ts (version 2).
// Player/team ids must belong to this game's rosters.
// Usage: node scripts/save-game-analysis.mjs <gameId> <file.json>
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const [gameId, file] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/i.test(gameId ?? '') || !file) throw new Error('Usage: node scripts/save-game-analysis.mjs <gameId> <file.json>');

const lib = {};
new Function('exports', ts.transpileModule(readFileSync('lib/game-analysis.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(lib);

const doc = JSON.parse(readFileSync(file, 'utf8'));
const problems = lib.analysisProblems(doc);
if (problems.length) throw new Error(`Invalid analysis: ${problems.join(', ')}`);

const game = checked(await db.from('games').select('season_id,home_team_id,visitor_team_id').eq('id', gameId).single());
const teamIds = [game.home_team_id, game.visitor_team_id];
const regs = checked(await db.from('season_teams').select('id').eq('season_id', game.season_id).in('team_id', teamIds));
const playerIds = new Set(checked(await db.from('rosters').select('player_id').in('season_team_id', regs.map((r) => r.id))).map((r) => r.player_id));
const text = JSON.stringify(doc);
const unknown = [
  ...doc.teamSections.map((s) => s.teamId).filter((id) => !teamIds.includes(id)),
  ...[...text.matchAll(/\{\{team:([0-9a-f-]{36})\}\}/gi)].map((m) => m[1]).filter((id) => !teamIds.includes(id)),
  ...[...doc.players.map((p) => p.playerId), ...doc.deciders.map((d) => d.playerId).filter(Boolean),
    ...[...text.matchAll(/\{\{player:([0-9a-f-]{36})\}\}/gi)].map((m) => m[1])].filter((id) => !playerIds.has(id)),
];
if (unknown.length) throw new Error(`Ids not in this game: ${[...new Set(unknown)].join(', ')}`);

const content = JSON.stringify(doc, null, 1);
if (content.length > 20000) throw new Error(`Content too long (${content.length} > 20000 chars)`);
checked(await db.from('game_analyses').upsert({ game_id: gameId, content, updated_at: new Date().toISOString() }));
const saved = checked(await db.from('game_analyses').select('content,updated_at').eq('game_id', gameId).single());
if (saved.content !== content) throw new Error('Verification failed: stored content differs');
console.log(`VERIFIED: analysis saved for ${gameId} (${content.length} chars, ${saved.updated_at}).`);
