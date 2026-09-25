// Dry run: node scripts/import-irts2-attendance.mjs
// Import:  node scripts/import-irts2-attendance.mjs --apply
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const source = JSON.parse(readFileSync(new URL('./irts2-attendance-data.json', import.meta.url), 'utf8'));
if (createHash('sha256').update(readFileSync(source.source)).digest('hex') !== source.sha256) throw new Error('Excel changed: regenerate the reviewed extract first.');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = ({ data, error }) => { if (error) throw error; return data; };
const normalize = name => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const clubs = checked(await db.from('clubs').select('id,name').ilike('name', 'Sono Brothers'));
if (clubs.length !== 1) throw new Error('Expected one Sono Brothers club.');
const club = clubs[0];
checked(await db.from('club_event_attendance').select('id').eq('status', 'sick').limit(1));
const members = checked(await db.from('club_staff').select('id,first_name,last_name,role').eq('club_id', club.id));
const events = checked(await db.from('club_events').select('id,start_at,end_at,location').eq('club_id', club.id).eq('event_type', 'gym_prep').gte('start_at', '2026-08-23T16:00:00Z').lt('start_at', '2026-09-24T16:00:00Z'));
const rows = [], eventIds = [], memberIds = new Set();
for (const session of source.sessions) {
  const matches = events.filter(e => Date.parse(e.start_at) === Date.parse(session.start));
  if (matches.length !== 1) throw new Error(`Event mismatch: ${session.date} ${session.session}`);
  const event = matches[0];
  if (event.location !== session.location || Date.parse(event.end_at) - Date.parse(event.start_at) !== 7200000) throw new Error(`Schedule mismatch: ${event.id}`);
  eventIds.push(event.id);
  for (const entry of session.entries) {
    const name = entry.name === 'G.Trevon Dominique' ? 'Graham Trevon Dominique' : entry.name;
    const matches = members.filter(m => normalize(`${m.last_name} ${m.first_name}`) === normalize(name));
    if (matches.length !== 1) throw new Error(`Member mismatch: ${entry.name}`);
    const member = matches[0];
    if (!['player', 'head_coach', 'assistant_coach'].includes(member.role)) throw new Error(`Unexpected role: ${entry.name}`);
    memberIds.add(member.id);
    rows.push({ event_id: event.id, club_staff_id: member.id, status: entry.status });
  }
}
const key = row => `${row.event_id}:${row.club_staff_id}`;
if (new Set(eventIds).size !== 33 || memberIds.size !== 16 || rows.length !== 504 || new Set(rows.map(key)).size !== rows.length) throw new Error('Import scope/count mismatch.');
const before = checked(await db.from('club_event_attendance').select('id,event_id,club_staff_id,status,created_at,updated_at').in('event_id', eventIds).limit(1000));
const existing = new Map(before.map(row => [key(row), row]));
const conflicts = rows.filter(row => existing.has(key(row)) && existing.get(key(row)).status !== row.status);
if (conflicts.length) throw new Error(`Existing attendance conflicts (${conflicts.length}); no writes performed.`);
const pending = rows.filter(row => !existing.has(key(row)));
const counts = Object.fromEntries(['present','late','absent','excused','sick'].map(status => [status, rows.filter(row => row.status === status).length]));
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', events: 33, members: 16, records: rows.length, counts, blankCellsSkipped: 24, newRecords: pending.length, alreadyMatching: rows.length - pending.length }));
if (process.argv.includes('--apply')) {
  const backup = new URL('./irts2-attendance-before.json', import.meta.url);
  if (!existsSync(backup)) writeFileSync(backup, JSON.stringify({ sourceHash: source.sha256, savedAt: new Date().toISOString(), clubId: club.id, before }, null, 2));
  if (pending.length) checked(await db.from('club_event_attendance').upsert(pending, { onConflict: 'event_id,club_staff_id', ignoreDuplicates: true }).select('id'));
  const after = checked(await db.from('club_event_attendance').select('event_id,club_staff_id,status').in('event_id', eventIds).limit(1000));
  const saved = new Map(after.map(row => [key(row), row.status]));
  if (rows.some(row => saved.get(key(row)) !== row.status)) throw new Error('Post-import verification failed.');
  const expected = new Set(rows.map(key));
  if (before.some(row => !expected.has(key(row)) && saved.get(key(row)) !== row.status)) throw new Error('Unrelated existing attendance changed.');
  writeFileSync(new URL('./irts2-attendance-result.json', import.meta.url), JSON.stringify({ verifiedAt: new Date().toISOString(), sourceHash: source.sha256, clubId: club.id, counts, rows }, null, 2));
  console.log('VERIFIED: all 504 source records match saved attendance; existing unrelated records preserved.');
}
