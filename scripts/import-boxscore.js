// One-off importer for vendor (Genius Sports / FIBA LiveStats) box score +
// play-by-play JSON exports into the import_* tables (see
// supabase/migrations/020_import_boxscore_data.sql). Usage:
//
//   node scripts/import-boxscore.js <path-to-json> [--game-date=YYYY-MM-DD]
//
// The vendor feed's text fields are mojibake (correct UTF-8 bytes that got
// decoded as Windows-1252 and re-saved as UTF-8 upstream, before this file
// ever reached us) — fixText() reverses that. A handful of Cyrillic
// characters don't round-trip losslessly and come out as "?"; those need a
// manual fix after import.

const fs = require("fs");
const path = require("path");
const iconv = require("iconv-lite");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

function fixText(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  try {
    return iconv.encode(value, "win1252").toString("utf8");
  } catch {
    return value;
  }
}

function deepFixText(value) {
  if (typeof value === "string") return fixText(value);
  if (Array.isArray(value)) return value.map(deepFixText);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepFixText(v);
    return out;
  }
  return value;
}

// gt/clock look like "MM:SS" or "MM:SS:cc" — not needed as a separate
// numeric column right now, stored as-is in import_pbp_events.

const TOTAL_STATS_PREFIX = "tot_s";
const PLAYER_STATS_PREFIX = "s";

function pickStats(obj, prefix) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(prefix)) out[k] = v;
  }
  // Also keep the small set of extra numeric fields that don't share the
  // s*/tot_s* prefix but are still per-team/per-player totals.
  for (const extra of ["eff_1", "eff_2", "eff_3", "eff_4", "eff_5", "eff_6", "eff_7",
    "tot_eff_1", "tot_eff_2", "tot_eff_3", "tot_eff_4", "tot_eff_5", "tot_eff_6", "tot_eff_7",
    "p1_score", "p2_score", "p3_score", "p4_score", "fouls", "timeouts", "active"]) {
    if (extra in obj) out[extra] = obj[extra];
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const gameDateArg = args.find((a) => a.startsWith("--game-date="));
  const gameDate = gameDateArg ? gameDateArg.split("=")[1] : null;

  if (!filePath) {
    console.error("Usage: node scripts/import-boxscore.js <path-to-json> [--game-date=YYYY-MM-DD]");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked .env.local)");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const data = deepFixText(raw);

  const tm1 = data.tm["1"];
  const tm2 = data.tm["2"];

  console.log(`Importing: ${tm1.name} (${tm1.score}) vs ${tm2.name} (${tm2.score})`);

  const { data: gameRow, error: gameErr } = await supabase
    .from("import_games")
    .insert({
      source: "geniussports",
      game_date: gameDate,
      period: data.period,
      period_length: data.periodLength,
      periods_max: data.periodsMax,
      attendance: data.attendance,
      home_team_name: tm1.name,
      home_team_name_international: tm1.nameInternational,
      home_score: tm1.score,
      away_team_name: tm2.name,
      away_team_name_international: tm2.nameInternational,
      away_score: tm2.score,
      raw: data,
    })
    .select("id")
    .single();

  if (gameErr) throw gameErr;
  const gameId = gameRow.id;
  console.log(`import_games row: ${gameId}`);

  const teamRows = [1, 2].map((teamNo) => {
    const t = data.tm[String(teamNo)];
    return {
      import_game_id: gameId,
      team_no: teamNo,
      name: t.name,
      name_international: t.nameInternational,
      short_name: t.shortName,
      code: t.code,
      logo_url: t.logoS?.url || t.logoT?.url || null,
      coach: t.coach,
      score: t.score,
      stats: pickStats(t, TOTAL_STATS_PREFIX),
    };
  });
  const { error: teamsErr } = await supabase.from("import_teams").insert(teamRows);
  if (teamsErr) throw teamsErr;
  console.log(`import_teams: ${teamRows.length} rows`);

  const playerRows = [];
  for (const teamNo of [1, 2]) {
    const t = data.tm[String(teamNo)];
    for (const pno of Object.keys(t.pl)) {
      const p = t.pl[pno];
      playerRows.push({
        import_game_id: gameId,
        team_no: teamNo,
        pno: Number(pno),
        shirt_number: p.shirtNumber,
        first_name: p.firstName,
        last_name: p.familyName,
        first_name_international: p.internationalFirstName,
        last_name_international: p.internationalFamilyName,
        position: p.playingPosition || null,
        starter: !!p.starter,
        photo_url: p.photoS || p.photoT || null,
        stats: pickStats(p, PLAYER_STATS_PREFIX),
      });
    }
  }
  const { error: playersErr } = await supabase.from("import_players").insert(playerRows);
  if (playersErr) throw playersErr;
  console.log(`import_players: ${playerRows.length} rows`);

  const pbpRows = data.pbp.map((p) => ({
    import_game_id: gameId,
    action_number: p.actionNumber,
    period: p.period,
    period_type: p.periodType,
    game_clock: p.gt,
    clock: p.clock,
    team_no: p.tno || null,
    pno: p.pno || null,
    player_name: p.player || null,
    shirt_number: p.shirtNumber || null,
    action_type: p.actionType,
    sub_type: p.subType || null,
    qualifier: p.qualifier || [],
    success: !!p.success,
    scoring: p.scoring || 0,
    score_home: p.s1 !== undefined ? Number(p.s1) : null,
    score_away: p.s2 !== undefined ? Number(p.s2) : null,
    lead: p.lead,
    previous_action: p.previousAction === "" ? null : Number(p.previousAction),
  }));
  // Batch insert to stay well under PostgREST's payload size limits.
  for (let i = 0; i < pbpRows.length; i += 200) {
    const { error } = await supabase.from("import_pbp_events").insert(pbpRows.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`import_pbp_events: ${pbpRows.length} rows`);

  const shotRows = [];
  for (const teamNo of [1, 2]) {
    const t = data.tm[String(teamNo)];
    for (const s of t.shot || []) {
      shotRows.push({
        import_game_id: gameId,
        action_number: s.actionNumber,
        team_no: teamNo,
        pno: s.pno,
        period: s.per,
        made: s.r === 1,
        x: s.x,
        y: s.y,
        action_type: s.actionType,
        sub_type: s.subType || null,
      });
    }
  }
  for (let i = 0; i < shotRows.length; i += 200) {
    const { error } = await supabase.from("import_shots").insert(shotRows.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`import_shots: ${shotRows.length} rows`);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
