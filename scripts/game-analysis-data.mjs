import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';

// Prints one game's statistics as JSON — the input for writing an expert
// analysis (see save-game-analysis.mjs). Every number comes from the same
// modules the report pages use, so the write-up matches what coaches see.
// Usage: node scripts/game-analysis-data.mjs <gameId>
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const gameId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(gameId ?? '')) throw new Error('Usage: node scripts/game-analysis-data.mjs <gameId>');

// Minimal CommonJS loader for the app's TypeScript stat modules.
const root = process.cwd();
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const out = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const req = (spec) => {
    const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : resolve(dirname(file), spec);
    const target = [base, `${base}.ts`, `${base}.tsx`].find((p) => existsSync(p) && !p.endsWith(spec.split('/').pop() + '/'));
    if (!target) throw new Error(`Cannot resolve ${spec} from ${file}`);
    return load(target);
  };
  new Function('exports', 'require', out)(exports, req);
  return exports;
}
const R = join(root, 'app/admin/tag/[gameId]');
const { elapsedSeconds } = load(join(R, 'reports/game-summary/summary-stats.ts'));
const { computePossessions } = load(join(R, 'reports/game-summary/pace-stats.ts'));
const { computeSetCategoryTotals, computeSetOffensePlayRows, computeDefenseSetDetailRows } = load(join(R, 'reports/coaching-stats/coaching-stats.ts'));
const { computeActionRows } = load(join(R, 'reports/screens-pnr/screen-stats.ts'));
const { computeBoxScore } = load(join(R, 'boxscore/stats.ts'));
const { computeBoxoutSummary } = load(join(R, 'reports/scouting-report/boxout-stats.ts'));
const { computeStarters, splitRotation } = load(join(R, 'reports/scouting-report/rotation-stats.ts'));
const { computeFourFactors, computePeriodScores } = load(join(R, 'reports/game-analysis-stats.ts'));
const { computePossessionTypes } = load(join(R, 'reports/possession-types.ts'));

const game = checked(await db.from('games').select('id,season_id,game_date,location,home_team_id,visitor_team_id,season:seasons(name),home:teams!games_home_team_id_fkey(name),visitor:teams!games_visitor_team_id_fkey(name)').eq('id', gameId).single());
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const page = checked(await db.from('game_events').select('*').eq('game_id', gameId).order('id').range(offset, offset + 999));
  rows.push(...page);
  if (page.length < 1000) break;
}
const regs = checked(await db.from('season_teams').select('id,team_id').eq('season_id', game.season_id).in('team_id', [game.home_team_id, game.visitor_team_id]));
const roster = regs.length ? checked(await db.from('rosters').select('season_team_id,number,player:players(id,first_name,last_name)').in('season_team_id', regs.map((r) => r.id))) : [];
const playerName = new Map(roster.map((r) => [r.player.id, `#${r.number} ${r.player.first_name} ${r.player.last_name}`]));
const name = (id) => playerName.get(id) ?? id;

const events = rows.map((e) => ({
  id: e.id, videoTime: Number(e.video_time), clockTime: Number(e.clock_time), period: e.period,
  t: elapsedSeconds({ period: e.period, clockTime: Number(e.clock_time) }),
  eventType: e.event_type, teamId: e.team_id, playerId: e.player_id, assistPlayerId: e.assist_player_id,
  points: e.points, andOne: !!e.and_one, shotType: e.shot_type ?? null, shotX: e.shot_x, shotY: e.shot_y,
  setOffenseName: e.set_offense_name, manToManType: e.man_to_man_type, zoneType: e.zone_type, pressType: e.press_type,
  defCoverageType: e.def_coverage_type, offActionType: e.off_action_type, boxoutType: e.boxout_type,
  screenRcvdType: e.screen_rcvd_type, screenerPlayerId: e.screener_player_id, defenderPlayerId: e.defender_player_id,
  turnoverType: e.turnover_type, defenseType: e.defense_type,
}));
const H = game.home_team_id, V = game.visitor_team_id;
const possessions = computePossessions(events, H, V);
const box = computeBoxScore(events, H, V);
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (m, a) => (a ? r1((m / a) * 100) : null);
const count = (teamId, types) => events.filter((e) => e.teamId === teamId && types.includes(e.eventType)).length;
// Defensive rows count opponent possessions (true PPP); offensive rows count
// calls, and a Set Offense call can cover several trips — so points per call.
const setRow = (t, perPossession) => ({
  [perPossession ? 'possessions' : 'calls']: t.sets, points: t.points,
  [perPossession ? 'ppp' : 'pointsPerCall']: t.sets ? r2(t.points / t.sets) : null,
  fg2: `${t.fgm2}/${t.fga2}`, fg3: `${t.fgm3}/${t.fga3}`, to: t.to, oreb: t.oreb, ftTrips: t.ftTrips,
});

function teamBlock(teamId, oppId, teamName) {
  const fgm2 = count(teamId, ['2pt_made']), fga2 = fgm2 + count(teamId, ['2pt_miss']);
  const fgm3 = count(teamId, ['3pt_made']), fga3 = fgm3 + count(teamId, ['3pt_miss']);
  const ftm = count(teamId, ['ft_made']), fta = ftm + count(teamId, ['ft_miss']);
  const oreb = count(teamId, ['off_reb']), dreb = count(teamId, ['def_reb']);
  const to = count(teamId, ['turnover']);
  const poss = possessions.filter((p) => p.teamId === teamId).length;
  const points = events.filter((e) => e.teamId === teamId).reduce((s, e) => s + (e.points ?? 0), 0);
  const byPeriod = {};
  for (const e of events) if (e.teamId === teamId && e.points) byPeriod[`Q${e.period}`] = (byPeriod[`Q${e.period}`] ?? 0) + e.points;

  const offense = Object.fromEntries(computeSetCategoryTotals(events, teamId, oppId, 'offense', 0, Infinity).map((t) => [t.category, setRow(t, false)]));
  const plays = computeSetOffensePlayRows(events, teamId, oppId, 0, Infinity).map((r) => ({ play: r.label, ...setRow(r.totals, false) }));
  const defense = Object.fromEntries(computeSetCategoryTotals(events, teamId, oppId, 'defense', 0, Infinity).map((t) => [t.category, setRow(t, true)]));
  const defenseDetail = computeDefenseSetDetailRows(events, teamId, oppId, 0, Infinity).map((r) => ({ scheme: r.label, ...setRow(r.totals, true) }));
  const actionRow = (r) => ({ category: r.category, possessions: r.count, points: r.points, ppp: r.count ? r2(r.points / r.count) : null, fg: `${r.fgm}/${r.fga}`, to: r.to });
  const pnrDefense = [...computeActionRows(events, teamId, oppId, 'defense', 'def_coverage', (e) => e.defCoverageType, possessions, 0, Infinity).values()].map(actionRow);
  const offActions = [...computeActionRows(events, teamId, oppId, 'offense', 'off_action', (e) => e.offActionType, possessions, 0, Infinity).values()].map(actionRow);
  const boxouts = computeBoxoutSummary(events, teamId, oppId);
  const starters = computeStarters(events, teamId);
  const players = [...box.values()].filter((s) => events.some((e) => e.teamId === teamId && e.playerId === s.playerId));
  const rotation = splitRotation(players, starters);
  const screens = {};
  for (const e of events) {
    if (e.teamId !== teamId || e.eventType !== 'screen_rcvd' || !e.playerId) continue;
    const key = `${name(e.playerId)} ← ${e.screenerPlayerId ? name(e.screenerPlayerId) : '?'}`;
    screens[key] ??= { use: 0, reject: 0 };
    if (e.screenRcvdType === 'Use') screens[key].use++; else if (e.screenRcvdType === 'Reject') screens[key].reject++;
  }
  const turnoverTypes = {};
  for (const e of events) if (e.teamId === teamId && e.eventType === 'turnover') turnoverTypes[e.turnoverType ?? 'Unspecified'] = (turnoverTypes[e.turnoverType ?? 'Unspecified'] ?? 0) + 1;
  const badDefense = {};
  for (const e of events) if (e.teamId === teamId && (e.eventType === 'bad_defense' || e.eventType === 'good_defense') && e.playerId) {
    const k = name(e.playerId); badDefense[k] ??= { good: 0, bad: 0 };
    badDefense[k][e.eventType === 'bad_defense' ? 'bad' : 'good']++;
  }

  return {
    team: teamName, points, byPeriod, possessions: poss, ppp: poss ? r2(points / poss) : null,
    shooting: { fg2: `${fgm2}/${fga2}`, fg2Pct: pct(fgm2, fga2), fg3: `${fgm3}/${fga3}`, fg3Pct: pct(fgm3, fga3), ft: `${ftm}/${fta}`, ftPct: pct(ftm, fta) },
    fourFactors: computeFourFactors(events, teamId, oppId, poss),
    rebounds: { oreb, dreb }, turnovers: to, turnoverTypes,
    // Every possession counted once: transition / inbound (BLOB, SLOB) / set / unstructured.
    possessionTypes: (() => {
      const { rows, unmatched } = computePossessionTypes(events, teamId, oppId, possessions);
      const total = rows.reduce((s, r) => s + r.possessions, 0);
      return {
        rows: rows.map((r) => ({ type: r.type, possessions: r.possessions, sharePct: total ? r1((r.possessions / total) * 100) : 0, points: r.points, ppp: r.possessions ? r2(r.points / r.possessions) : null, fg: `${r.fgm}/${r.fga}`, fg3: `${r.fg3m}/${r.fg3a}`, to: r.turnovers })),
        unmatchedPoints: unmatched.points,
      };
    })(),
    offenseSets: offense, setPlays: plays, offActions,
    defenseSets: defense, defenseDetail, pnrDefense,
    boxouts: {
      good: boxouts.good.length, bad: boxouts.bad.length, opponentOreb: boxouts.opponentOreb.length,
      byPlayer: boxouts.rows.map((r) => ({ player: name(r.playerId), good: r.good.length, bad: r.bad.length })),
    },
    goodBadDefense: badDefense,
    rotation: {
      startersTagged: starters.size > 0, starterPoints: rotation.starters.points, benchPoints: rotation.bench.points,
    },
    screenPartnerships: screens,
    // Write {{player:<id>}} / {{team:<id>}} in the analysis to show photo/logo chips.
    teamRef: `{{team:${teamId}}}`,
    playerRefs: Object.fromEntries(players.map((s) => [name(s.playerId), `{{player:${s.playerId}}}`])),
    players: players.sort((a, b) => b.pts - a.pts).map((s) => ({
      player: name(s.playerId), starter: starters.has(s.playerId), min: Math.round(s.minSeconds / 60), pts: s.pts,
      fg2: `${s.fg2m}/${s.fg2a}`, fg3: `${s.fg3m}/${s.fg3a}`, ft: `${s.ftm}/${s.fta}`,
      reb: s.oreb + s.dreb, ast: s.ast, to: s.to, stl: s.stl, blk: s.blk, pf: s.pf, plusMinus: s.plusMinus,
    })),
  };
}

const eventCounts = {};
for (const e of events) eventCounts[e.eventType] = (eventCounts[e.eventType] ?? 0) + 1;
console.log(JSON.stringify({
  periodScores: computePeriodScores(events, H, V),
  game: { id: game.id, homeTeamId: H, visitorTeamId: V, season: game.season?.name, date: game.game_date, location: game.location, home: game.home?.name, visitor: game.visitor?.name, periods: Math.max(0, ...events.map((e) => e.period)) },
  dataCoverage: { totalEvents: events.length, eventCounts },
  home: teamBlock(H, V, game.home?.name),
  visitor: teamBlock(V, H, game.visitor?.name),
}, null, 1));
