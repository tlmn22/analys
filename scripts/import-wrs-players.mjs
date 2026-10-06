import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

// Western Warriors (WRS) roster for The League 2026-2027.
// Source order is "first name, last name" as given; first names were all-caps in the source.
// Usage: node scripts/import-wrs-players.mjs [--apply] | --roster [--apply]
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const SEASON_ID = 'ec947bce-d335-4781-8caa-9f71b3d5303c';
const TEAM_ID = 'd3102d9b-768f-4708-80ea-fba629d7797d';
const title = value => value.toLocaleLowerCase('mn').replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('mn'));
const source = [
  [1, 'BELL', 'Randy'],
  [2, 'БАЯРЖАВХЛАН', 'Гансүх'],
  [3, 'ТЭМҮҮЖИН', 'Ариунболд'],
  [4, 'ЧИНБААТАР', 'Чинзориг'],
  [5, 'БОЛДБААТАР', 'Бат-Эрдэнэ'],
  [6, 'МӨНХБААТАР', 'Сугар'],
  [7, 'ДАМДИНЖАВ', 'Ганхуяг'],
  [8, 'ЦОГБАДРАХ', 'Тайван'],
  [9, 'ӨЛЗИЙБАТ', 'Мягмарсүрэн'],
  [10, 'TANAKA', 'Chikara'],
  [11, 'ДОРЖСҮРЭН', 'Бямба'],
  [14, 'БИЛГҮҮН', 'Ганга'],
  [19, 'НЯМБАЯР', 'Олзвой'],
  [21, 'ЭРДЭНЭДАЛАЙ', 'Сүхбаатар'],
  [24, 'ALI', 'Mubashar ahmed'],
].map(([number, first_name, last_name]) => ({ number, first_name: title(first_name), last_name }));
const norm = value => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const key = p => `${norm(p.last_name)}:${norm(p.first_name)}`;
async function allPlayers() {
  const players = [];
  for (let offset = 0; ; offset += 500) {
    const rows = checked(await db.from('players').select('id,first_name,last_name,position').order('id').range(offset, offset + 499));
    players.push(...rows);
    if (rows.length < 500) return players;
  }
}
const before = await allPlayers();
const missing = [];
for (const p of source) {
  const matches = before.filter(row => key(row) === key(p));
  if (matches.length > 1) throw new Error(`Duplicate existing player: ${key(p)}`);
  if (!matches.length) missing.push(p);
  console.log(JSON.stringify({ ...p, status: matches.length ? 'existing' : 'new', similar: matches.length ? [] : before.filter(row => norm(row.first_name) === norm(p.first_name) || norm(row.last_name) === norm(p.last_name)) }));
}
if (process.argv.includes('--apply') && !process.argv.includes('--roster')) {
  if (missing.length) checked(await db.from('players').insert(missing.map(({ first_name, last_name }) => ({ first_name, last_name, position: 'SF', active: true, photo_url: null }))));
  const after = await allPlayers();
  for (const p of source) {
    if (after.filter(row => key(row) === key(p)).length !== 1) throw new Error(`Verification failed: ${key(p)}`);
  }
  console.log(`VERIFIED: ${missing.length} created; ${source.length - missing.length} existing; ${source.length} total.`);
}
if (process.argv.includes('--roster')) {
  if (missing.length) throw new Error('Create missing players before assigning a roster');
  const season = checked(await db.from('seasons').select('id,name').eq('id', SEASON_ID).single());
  const team = checked(await db.from('teams').select('id,name').eq('id', TEAM_ID).single());
  if (season.name !== 'The League 2026-2027' || team.name !== 'Western Warriors') throw new Error('Target name changed');
  const registration = checked(await db.from('season_teams').select('id').eq('season_id', season.id).eq('team_id', team.id).single());
  const existing = checked(await db.from('rosters').select('id,player_id,number').eq('season_team_id', registration.id));
  const desired = source.map(p => ({ season_team_id: registration.id, player_id: before.find(row => key(row) === key(p)).id, number: p.number }));
  for (const row of desired) {
    if (existing.some(r => r.number === row.number && r.player_id !== row.player_id)) throw new Error(`Jersey number ${row.number} is already occupied`);
    if (existing.some(r => r.player_id === row.player_id && r.number !== row.number)) throw new Error(`Player already registered with a different number: ${row.player_id}`);
  }
  const additions = desired.filter(row => !existing.some(r => r.player_id === row.player_id));
  console.log(JSON.stringify({ season: season.name, team: team.name, existing: existing.length, additions: additions.length }));
  if (process.argv.includes('--apply')) {
    if (additions.length) checked(await db.from('rosters').insert(additions));
    const saved = checked(await db.from('rosters').select('id,player_id,number').eq('season_team_id', registration.id));
    for (const row of desired) {
      if (saved.filter(r => r.player_id === row.player_id && r.number === row.number).length !== 1) throw new Error('Roster verification failed');
    }
    for (const row of existing) {
      if (!saved.some(r => r.id === row.id && r.player_id === row.player_id && r.number === row.number)) throw new Error('Existing roster changed');
    }
    console.log(`VERIFIED: ${desired.length} players registered with requested numbers; ${additions.length} added.`);
  }
}
