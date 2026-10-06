import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

// The League 2026-2027 schedule, Oct 2-8 2026 (M Bank Arena). Times are Ulaanbaatar (+08:00);
// the first team listed is home. Games already created for the same pair (within a day) are skipped.
// Usage: node scripts/import-league-week1-games.mjs [--apply]
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const SEASON_ID = 'ec947bce-d335-4781-8caa-9f71b3d5303c';
const LOCATION = 'М Bank arena';
const TEAM = {
  'SG APES': 'SG Apes', 'BCH KNIGHTS': 'BCH Knights', 'BRONCOS': 'Өмнөговийн Хүлэгүүд', 'SELENGE BODONS': 'Сэлэнгэ Бодонс',
  'TLG TUSHIG BAGANA': 'TLG TushigBagana', 'OMNI ERDENET MINERS': 'Omni Erdenet Miners', 'KHAN FALCONS': 'Khan Falcons',
  'SONO BROTHERS': 'Sono Brothers', 'DARKHAN UNITED': 'Darkhan United', 'WESTERN WARRIORS': 'Western Warriors',
};
const schedule = [
  ['2026-10-02', '18:10', 'SG APES', 'BCH KNIGHTS'],
  ['2026-10-02', '20:40', 'BRONCOS', 'SELENGE BODONS'],
  ['2026-10-03', '12:10', 'TLG TUSHIG BAGANA', 'OMNI ERDENET MINERS'],
  ['2026-10-03', '14:10', 'KHAN FALCONS', 'SONO BROTHERS'],
  ['2026-10-03', '16:10', 'DARKHAN UNITED', 'WESTERN WARRIORS'],
  ['2026-10-04', '14:10', 'BCH KNIGHTS', 'BRONCOS'],
  ['2026-10-04', '16:10', 'SELENGE BODONS', 'SG APES'],
  ['2026-10-05', '18:10', 'TLG TUSHIG BAGANA', 'KHAN FALCONS'],
  ['2026-10-05', '20:10', 'OMNI ERDENET MINERS', 'WESTERN WARRIORS'],
  ['2026-10-06', '18:10', 'BCH KNIGHTS', 'SONO BROTHERS'],
  ['2026-10-06', '20:10', 'SELENGE BODONS', 'DARKHAN UNITED'],
  ['2026-10-07', '16:10', 'WESTERN WARRIORS', 'KHAN FALCONS'],
  ['2026-10-07', '18:10', 'TLG TUSHIG BAGANA', 'BRONCOS'],
  ['2026-10-07', '20:10', 'OMNI ERDENET MINERS', 'SG APES'],
  ['2026-10-08', '18:10', 'DARKHAN UNITED', 'BCH KNIGHTS'],
  ['2026-10-08', '20:10', 'SONO BROTHERS', 'SELENGE BODONS'],
];

const season = checked(await db.from('seasons').select('id,name').eq('id', SEASON_ID).single());
if (season.name !== 'The League 2026-2027') throw new Error('Target season changed');
const registered = checked(await db.from('season_teams').select('team:teams(id,name)').eq('season_id', SEASON_ID)).map(r => r.team);
const teamId = label => {
  const team = registered.find(t => t.name === TEAM[label]);
  if (!team) throw new Error(`Team not registered in season: ${label}`);
  return team.id;
};
const existing = checked(await db.from('games').select('id,home_team_id,visitor_team_id,game_date').eq('season_id', SEASON_ID));
// Within a day of the scheduled tip-off: some older games were saved with a shifted time zone.
const samePairSameDay = (g, row) => g.game_date && Math.abs(new Date(g.game_date) - new Date(row.game_date)) <= 24 * 3600_000 &&
  [g.home_team_id, g.visitor_team_id].sort().join() === [row.home_team_id, row.visitor_team_id].sort().join();
const rows = schedule.map(([day, time, home, visitor]) => ({ day, label: `${day} ${time} ${home} vs ${visitor}`, home_team_id: teamId(home), visitor_team_id: teamId(visitor), game_date: `${day}T${time}:00+08:00` }));
const additions = [];
for (const row of rows) {
  const match = existing.find(g => samePairSameDay(g, row));
  console.log(`${match ? 'EXISTS' : 'NEW   '} ${row.label}${match ? ` (${match.id})` : ''}`);
  if (!match) additions.push(row);
}
console.log(`${additions.length} to create, ${rows.length - additions.length} existing.`);
if (process.argv.includes('--apply') && additions.length) {
  const inserted = checked(await db.from('games').insert(additions.map(({ home_team_id, visitor_team_id, game_date }) => ({
    season_id: SEASON_ID, home_team_id, visitor_team_id, game_date, location: LOCATION, game_type: 'league', video_url: null, home_team_color: null, visitor_team_color: null,
  }))).select('id'));
  const after = checked(await db.from('games').select('id,home_team_id,visitor_team_id,game_date').eq('season_id', SEASON_ID));
  for (const row of rows) if (after.filter(g => samePairSameDay(g, row)).length !== 1) throw new Error(`Verification failed: ${row.label}`);
  console.log(`VERIFIED: ${inserted.length} games created; every scheduled game exists exactly once.`);
}
