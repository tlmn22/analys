// One-off analysis script: pulls one game's tagged events + rosters and
// prints team-level summary stats (shooting, four factors, rebounding,
// turnovers, top scorers) to support a win/loss breakdown. Read-only.
//
//   node scripts/game-summary-analysis.js <gameId>

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const gameId = process.argv[2];
if (!gameId) {
  console.error("Usage: node scripts/game-summary-analysis.js <gameId>");
  process.exit(1);
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const FGA_TYPES = new Set(["2pt_made", "2pt_miss", "3pt_made", "3pt_miss"]);
const FTA_TYPES = new Set(["ft_made", "ft_miss"]);

function pct(m, a) {
  return a > 0 ? ((m / a) * 100).toFixed(1) + "%" : "-";
}

async function main() {
  const { data: game, error: gameErr } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (gameErr || !game) {
    console.error("Game not found:", gameErr?.message);
    process.exit(1);
  }

  const [teamsRes, eventsRes, seasonTeamsRes] = await Promise.all([
    db.from("teams").select("id, name").in("id", [game.home_team_id, game.visitor_team_id]),
    db.from("game_events").select("*").eq("game_id", gameId),
    db
      .from("season_teams")
      .select("id, team_id")
      .eq("season_id", game.season_id)
      .in("team_id", [game.home_team_id, game.visitor_team_id]),
  ]);

  const teamsById = new Map(teamsRes.data.map((t) => [t.id, t]));
  const seasonTeamIdByTeamId = new Map(seasonTeamsRes.data.map((st) => [st.team_id, st.id]));
  const stIds = [...seasonTeamIdByTeamId.values()];
  const { data: rosterRows } = stIds.length
    ? await db
        .from("rosters")
        .select("season_team_id, number, player:players(id, first_name, last_name)")
        .in("season_team_id", stIds)
    : { data: [] };

  const playerById = new Map();
  for (const r of rosterRows ?? []) {
    playerById.set(r.player.id, { number: r.number, name: `${r.player.first_name} ${r.player.last_name}` });
  }

  const events = eventsRes.data ?? [];
  const homeId = game.home_team_id;
  const visId = game.visitor_team_id;

  function teamStats(teamId, oppId) {
    const mine = events.filter((e) => e.team_id === teamId);
    const opp = events.filter((e) => e.team_id === oppId);
    const fga = mine.filter((e) => FGA_TYPES.has(e.event_type)).length;
    const fgm = mine.filter((e) => e.event_type === "2pt_made" || e.event_type === "3pt_made").length;
    const fga2 = mine.filter((e) => e.event_type === "2pt_made" || e.event_type === "2pt_miss").length;
    const fgm2 = mine.filter((e) => e.event_type === "2pt_made").length;
    const fga3 = mine.filter((e) => e.event_type === "3pt_made" || e.event_type === "3pt_miss").length;
    const fgm3 = mine.filter((e) => e.event_type === "3pt_made").length;
    const fta = mine.filter((e) => FTA_TYPES.has(e.event_type)).length;
    const ftm = mine.filter((e) => e.event_type === "ft_made").length;
    const points = mine.reduce((s, e) => s + (e.points || 0), 0);
    const oreb = mine.filter((e) => e.event_type === "off_reb").length;
    const dreb = mine.filter((e) => e.event_type === "def_reb").length;
    const oppOreb = opp.filter((e) => e.event_type === "off_reb").length;
    const oppDreb = opp.filter((e) => e.event_type === "def_reb").length;
    const to = mine.filter((e) => e.event_type === "turnover").length;
    const ast = mine.filter((e) => e.event_type === "assist" || e.event_type === "other_assist").length +
      mine.filter((e) => e.assist_player_id).length;
    const stl = mine.filter((e) => e.event_type === "steal").length;
    const blk = mine.filter((e) => e.event_type === "block").length;
    const pf = mine.filter((e) => e.event_type === "off_foul" || e.event_type === "def_foul" || e.event_type === "loose_ball_foul").length;
    const poss = Math.max(0, fga + 0.44 * fta + to - oreb);
    const efg = fga > 0 ? ((fgm + 0.5 * fgm3) / fga) * 100 : 0;
    const tovPct = poss > 0 ? (to / poss) * 100 : 0;
    const orebPct = oreb + oppDreb > 0 ? (oreb / (oreb + oppDreb)) * 100 : 0;
    const ftRate = fga > 0 ? (fta / fga) * 100 : 0;
    const ppp = poss > 0 ? points / poss : 0;

    const byPlayer = new Map();
    for (const e of mine) {
      if (!e.player_id) continue;
      const p = playerById.get(e.player_id);
      if (!p) continue;
      const s = byPlayer.get(e.player_id) ?? { ...p, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 };
      if (e.event_type === "2pt_made") s.pts += 2;
      if (e.event_type === "3pt_made") s.pts += 3;
      if (e.event_type === "ft_made") s.pts += 1;
      if (e.event_type === "off_reb" || e.event_type === "def_reb") s.reb += 1;
      if (e.event_type === "assist") s.ast += 1;
      if (e.event_type === "steal") s.stl += 1;
      if (e.event_type === "block") s.blk += 1;
      if (e.event_type === "turnover") s.to += 1;
      byPlayer.set(e.player_id, s);
    }
    for (const e of mine) {
      if (e.assist_player_id) {
        const p = playerById.get(e.assist_player_id);
        if (!p) continue;
        const s = byPlayer.get(e.assist_player_id) ?? { ...p, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 };
        s.ast += 1;
        byPlayer.set(e.assist_player_id, s);
      }
    }
    const topScorers = [...byPlayer.values()].sort((a, b) => b.pts - a.pts).slice(0, 5);

    return {
      points, fga, fgm, fga2, fgm2, fga3, fgm3, fta, ftm, oreb, dreb, to, ast, stl, blk, pf,
      efg, tovPct, orebPct, ftRate, ppp, poss, topScorers,
    };
  }

  const home = teamStats(homeId, visId);
  const vis = teamStats(visId, homeId);

  // Per-period score
  const periods = [...new Set(events.map((e) => e.period))].sort((a, b) => a - b);
  const periodTotals = periods.map((p) => {
    const pe = events.filter((e) => e.period === p && e.points > 0);
    const h = pe.filter((e) => e.team_id === homeId).reduce((s, e) => s + e.points, 0);
    const v = pe.filter((e) => e.team_id === visId).reduce((s, e) => s + e.points, 0);
    return { p, h, v };
  });

  console.log("=== GAME ===");
  console.log(`${teamsById.get(homeId)?.name} (home) vs ${teamsById.get(visId)?.name} (visitor)`);
  console.log("Final:", home.points, "-", vis.points);
  console.log("By period:", periodTotals.map((pt) => `Q${pt.p}: ${pt.h}-${pt.v}`).join("  "));
  console.log();

  function printTeam(label, s) {
    console.log(`--- ${label} ---`);
    console.log(`PTS ${s.points} | FG ${s.fgm}/${s.fga} (${pct(s.fgm, s.fga)}) | 2P ${s.fgm2}/${s.fga2} (${pct(s.fgm2, s.fga2)}) | 3P ${s.fgm3}/${s.fga3} (${pct(s.fgm3, s.fga3)}) | FT ${s.ftm}/${s.fta} (${pct(s.ftm, s.fta)})`);
    console.log(`OREB ${s.oreb} | DREB ${s.dreb} | TOT REB ${s.oreb + s.dreb} | AST ${s.ast} | TO ${s.to} | STL ${s.stl} | BLK ${s.blk} | PF ${s.pf}`);
    console.log(`eFG% ${s.efg.toFixed(1)}% | TOV% ${s.tovPct.toFixed(1)}% | OREB% ${s.orebPct.toFixed(1)}% | FT Rate ${s.ftRate.toFixed(1)}% | Est. Poss ${s.poss.toFixed(1)} | PPP ${s.ppp.toFixed(2)}`);
    console.log("Top scorers:", s.topScorers.map((p) => `#${p.number} ${p.name} ${p.pts}p/${p.reb}r/${p.ast}a`).join(", "));
    console.log();
  }

  printTeam(teamsById.get(homeId)?.name + " (home)", home);
  printTeam(teamsById.get(visId)?.name + " (visitor)", vis);

  console.log("Total tagged events:", events.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
