"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  ListChecks,
  Minus,
  Quote,
  Shield,
  Sparkles,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from "lucide-react";
import type { AnalysisDoc, AnalysisLang, BiText, Verdict } from "@/lib/game-analysis";
import type { FourFactors } from "@/app/admin/tag/[gameId]/reports/game-analysis-stats";

export type AnalysisPlayer = { id: string; number: number; name: string; photoUrl: string | null; teamId: string };
export type AnalysisTeam = { id: string; name: string; logoUrl: string | null; score: number };

export type GameAnalysisCardProps = {
  doc: AnalysisDoc;
  updatedAt: string; // already formatted, Ulaanbaatar time
  home: AnalysisTeam;
  visitor: AnalysisTeam;
  quarters: { label: string; home: number; visitor: number }[];
  fourFactors: { home: FourFactors; visitor: FourFactors };
  playersById: Record<string, AnalysisPlayer>;
};

type Side = "home" | "visitor";

/* Labels for both languages. */
const LABELS = {
  mn: {
    title: "Шинжээчийн дүгнэлт", updated: "Шинэчилсэн", final: "Эцсийн оноо", margin: (n: number) => `${n} онооны зөрүү`,
    total: "Нийт", team: "Баг", periodScores: "Үе тус бүрийн оноо", home: "Талбайн эзэн", away: "Зочин", won: "Хожсон",
    deciders: "Тоглолтыг шийдсэн хүчин зүйлс", fourFactors: "Four Factors", better: "илүү", lowerBetter: "бага нь сайн",
    eFG: "Шидэлтийн оновч (eFG%)", tov: "Бөмбөг алдалт (TOV%)", orb: "Довтолгооны самбар (ORB%)", ftr: "Торгуулийн давтамж (FT rate)",
    teams: "Багуудын дүн шинжилгээ", offense: "Довтолгоо", defense: "Хамгаалалт", players: "Тоглогчид",
    keys: "Дараагийн тоглолтын түлхүүрүүд", caveats: "Өгөгдлийн анхааруулга", logo: "лого", language: "Хэл",
    verdict: { good: "Сайн", bad: "Анхаарах", neutral: "Дундаж" },
  },
  en: {
    title: "Expert Analysis", updated: "Updated", final: "Final", margin: (n: number) => `${n}-point margin`,
    total: "Total", team: "Team", periodScores: "Score by period", home: "Home", away: "Away", won: "Won",
    deciders: "What Decided the Game", fourFactors: "Four Factors", better: "better", lowerBetter: "lower is better",
    eFG: "Effective FG%", tov: "Turnover %", orb: "Offensive Rebound %", ftr: "Free Throw Rate",
    teams: "Team breakdown", offense: "Offense", defense: "Defense", players: "Players",
    keys: "Keys for the Next Game", caveats: "Data Notes", logo: "logo", language: "Language",
    verdict: { good: "Strong", bad: "Concern", neutral: "Neutral" },
  },
} as const;
type Labels = (typeof LABELS)[AnalysisLang];

/* Home = blue, visitor = amber: different in lightness as well as hue, so they
 * stay distinguishable for color-blind readers. Emerald is the brand accent. */
const ACCENT: Record<Side, { bar: string; soft: string; dot: string }> = {
  home: {
    bar: "bg-sky-600 dark:bg-sky-400",
    soft: "bg-sky-100 text-sky-900 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-400/25",
    dot: "bg-sky-600 dark:bg-sky-400",
  },
  visitor: {
    bar: "bg-amber-500 dark:bg-amber-400",
    soft: "bg-amber-100 text-amber-950 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/25",
    dot: "bg-amber-500 dark:bg-amber-400",
  },
};

const VERDICT: Record<Verdict, { Icon: typeof ThumbsUp; pill: string; ring: string }> = {
  good: { Icon: ThumbsUp, pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", ring: "ring-emerald-500 dark:ring-emerald-400" },
  bad: { Icon: ThumbsDown, pill: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", ring: "ring-red-500 dark:ring-red-400" },
  neutral: { Icon: Minus, pill: "bg-muted text-muted-foreground", ring: "ring-zinc-300 dark:ring-zinc-600" },
};

const FACTORS: { key: keyof FourFactors; label: "eFG" | "tov" | "orb" | "ftr"; lowerIsBetter?: boolean; max: number; format: (v: number) => string }[] = [
  { key: "eFGPct", label: "eFG", max: 70, format: (v) => `${v.toFixed(1)}%` },
  { key: "tovPct", label: "tov", max: 30, lowerIsBetter: true, format: (v) => `${v.toFixed(1)}%` },
  { key: "orbPct", label: "orb", max: 60, format: (v) => `${v.toFixed(1)}%` },
  { key: "ftRate", label: "ftr", max: 0.6, format: (v) => v.toFixed(2) },
];

const LANG_KEY = "hoopslab.analysisLang";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Ctx = { lang: AnalysisLang; t: Labels; home: AnalysisTeam; visitor: AnalysisTeam; playersById: Record<string, AnalysisPlayer> };
const CardContext = createContext<Ctx | null>(null);
const useCard = () => useContext(CardContext)!;

/* ── Small building blocks ─────────────────────────────────────────────── */

/** Text with **bold** and {{player:id}} / {{team:id}} chips. */
function RichText({ text }: { text: string }) {
  const { home, visitor, playersById } = useCard();
  const parts = text.split(/(\*\*[^*]+\*\*|\{\{(?:player|team):[0-9a-f-]{36}\}\})/gi);
  return (
    <>
      {parts.map((p, i) => {
        if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground"><RichText text={p.slice(2, -2)} /></strong>;
        }
        const token = p.match(/^\{\{(player|team):([0-9a-f-]{36})\}\}$/i);
        if (token?.[1] === "player") {
          const player = playersById[token[2]];
          if (!player) return <Fragment key={i}>—</Fragment>;
          return (
            <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap align-middle font-semibold text-foreground">
              <PlayerAvatar player={player} side={player.teamId === visitor.id ? "visitor" : "home"} size={20} />#{player.number} {player.name}
            </span>
          );
        }
        if (token?.[1] === "team") {
          const team = token[2] === visitor.id ? visitor : token[2] === home.id ? home : null;
          if (!team) return <Fragment key={i}>—</Fragment>;
          return (
            <span key={i} className="inline-flex items-center gap-1 whitespace-nowrap align-middle font-semibold text-foreground">
              <TeamLogo team={team} side={team === visitor ? "visitor" : "home"} size="xs" />{team.name}
            </span>
          );
        }
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Bi({ text }: { text: BiText }) {
  const { lang } = useCard();
  return <RichText text={text[lang] || text.mn} />;
}

function TeamLogo({ team, side, size = "md" }: { team: AnalysisTeam; side: Side; size?: "xs" | "sm" | "md" | "lg" }) {
  const { t } = useCard();
  const dims = {
    xs: "size-5 rounded text-[8px]",
    sm: "size-8 rounded-md text-[10px]",
    md: "size-10 rounded-lg text-xs",
    lg: "size-12 sm:size-14 rounded-xl text-xs sm:text-sm",
  }[size];
  if (team.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logoUrl} alt={`${team.name} ${t.logo}`} className={cx(dims, "shrink-0 object-contain")} />;
  }
  const initials = Array.from(team.name.replace(/\s+/g, "")).slice(0, 3).join("").toUpperCase();
  return (
    <span role="img" aria-label={`${team.name} ${t.logo}`}
      className={cx(dims, ACCENT[side].soft, "inline-flex shrink-0 select-none items-center justify-center font-bold tracking-wider ring-1 ring-inset")}>
      {initials}
    </span>
  );
}

function PlayerAvatar({ player, side, size = 48, ringClass }: { player: AnalysisPlayer; side: Side; size?: 20 | 40 | 48 | 56; ringClass?: string }) {
  const dims = { 20: "size-5 text-[9px]", 40: "size-10 text-sm", 48: "size-12 text-base", 56: "size-14 text-lg" }[size];
  const ring = ringClass ? cx("ring-2 ring-offset-2 ring-offset-card", ringClass) : "";
  if (player.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={player.photoUrl} alt={`#${player.number} ${player.name}`} className={cx(dims, ring, "shrink-0 rounded-full bg-muted object-cover")} />;
  }
  // Jersey-number fallback, tinted with the team accent.
  return (
    <span role="img" aria-label={`#${player.number} ${player.name}`}
      className={cx(dims, ring, ACCENT[side].soft, "relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tabular-nums ring-inset", !ringClass && "ring-1")}>
      {size > 20 && <span className="absolute top-1.5 text-[7px] font-semibold uppercase leading-none tracking-widest opacity-60">#</span>}
      <span className={cx("leading-none", size > 20 && "mt-1")}>{player.number}</span>
    </span>
  );
}

function SectionHeading({ id, icon: Icon, children, aside }: { id: string; icon: typeof Sparkles; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <h3 id={id} className="flex items-center gap-2 text-base font-semibold tracking-tight sm:text-lg">
        <Icon aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400 sm:size-5" />
        {children}
      </h3>
      {aside}
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: AnalysisLang; onChange: (lang: AnalysisLang) => void }) {
  return (
    <div role="radiogroup" aria-label={LABELS[lang].language} className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs font-semibold">
      {(["mn", "en"] as const).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} onClick={() => onChange(l)}
          className={cx("rounded-md px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-600",
            lang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {l === "mn" ? "МН" : "EN"}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */

export function GameAnalysisCard({ doc, updatedAt, home, visitor, quarters, fourFactors, playersById }: GameAnalysisCardProps) {
  const [lang, setLang] = useState<AnalysisLang>("mn");
  // Remember the reader's language; read after mount so server and client HTML match.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "en" || saved === "mn") setLang(saved);
    } catch {}
  }, []);
  const changeLang = (next: AnalysisLang) => {
    setLang(next);
    try { window.localStorage.setItem(LANG_KEY, next); } catch {}
  };

  const t = LABELS[lang];
  const sideOf = (teamId: string): Side => (teamId === visitor.id ? "visitor" : "home");
  const teamOf = (teamId: string) => (teamId === visitor.id ? visitor : home);
  const winner: Side | null = home.score === visitor.score ? null : home.score > visitor.score ? "home" : "visitor";
  const margin = Math.abs(home.score - visitor.score);
  const teamSections = doc.teamSections.filter((s) => s.offense.length || s.defense.length);
  const keys = doc.keys.filter((k) => k.items.length);
  const players = doc.players.filter((p) => playersById[p.playerId]);

  return (
    <CardContext.Provider value={{ lang, t, home, visitor, playersById }}>
      <section aria-labelledby="gac-title" lang={lang} className="w-full overflow-hidden rounded-2xl border bg-card text-card-foreground">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6 lg:px-8">
          <h2 id="gac-title" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight sm:text-xl">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <Sparkles aria-hidden className="size-4" />
            </span>
            {t.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
              <Clock aria-hidden className="size-3.5" />
              {t.updated}: <time className="tabular-nums">{updatedAt}</time>
            </p>
            <LangToggle lang={lang} onChange={changeLang} />
          </div>
        </header>

        <div className="space-y-10 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {/* Scoreboard */}
          <div className="rounded-xl border bg-muted/40 p-4 sm:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
              <ScoreTeam team={home} side="home" isWinner={winner === "home"} align="start" />
              <div className="text-center">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{t.final}</p>
                <p className="flex items-baseline justify-center gap-2 font-bold tabular-nums leading-none sm:gap-3">
                  <span className={cx("text-4xl sm:text-6xl", winner === "home" ? "text-foreground" : "text-muted-foreground")}>{home.score}</span>
                  <span aria-hidden className="text-2xl text-muted-foreground/60 sm:text-4xl">–</span>
                  <span className={cx("text-4xl sm:text-6xl", winner === "visitor" ? "text-foreground" : "text-muted-foreground")}>{visitor.score}</span>
                </p>
                {margin > 0 && <p className="mt-2 text-xs text-muted-foreground tabular-nums">{t.margin(margin)}</p>}
              </div>
              <ScoreTeam team={visitor} side="visitor" isWinner={winner === "visitor"} align="end" />
            </div>

            {quarters.length > 0 && (
              <div className="mx-auto mt-6 max-w-xl overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">{t.periodScores}</caption>
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th scope="col" className="py-1.5 pr-2 text-left font-medium"><span className="sr-only">{t.team}</span></th>
                      {quarters.map((q) => <th key={q.label} scope="col" className="px-1 py-1.5 text-center font-medium sm:px-2">{q.label}</th>)}
                      <th scope="col" className="py-1.5 pl-2 text-right font-semibold text-foreground">{t.total}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t">
                    {(["home", "visitor"] as const).map((side) => {
                      const team = side === "home" ? home : visitor;
                      const other: Side = side === "home" ? "visitor" : "home";
                      return (
                        <tr key={side}>
                          <th scope="row" className="py-2 pr-2 text-left font-medium">
                            <span className="flex items-center gap-2">
                              <span aria-hidden className={cx("size-2 rounded-full", ACCENT[side].dot)} />
                              <span className="max-w-[5.5rem] truncate sm:max-w-[9rem]">{team.name}</span>
                            </span>
                          </th>
                          {quarters.map((q) => (
                            <td key={q.label} className={cx("px-1 py-2 text-center sm:px-2", q[side] > q[other] ? "font-semibold text-foreground" : "text-muted-foreground")}>
                              {q[side]}
                            </td>
                          ))}
                          <td className={cx("py-2 pl-2 text-right font-bold", winner === side ? "text-foreground" : "text-muted-foreground")}>{team.score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary */}
          {doc.summary[lang] && (
            <figure className="relative rounded-xl bg-emerald-50 px-5 py-5 dark:bg-emerald-950/40 sm:px-8 sm:py-7">
              <Quote aria-hidden className="absolute right-5 top-5 hidden size-10 text-emerald-600/15 dark:text-emerald-400/20 sm:block" />
              <blockquote className="text-pretty text-base font-medium leading-relaxed text-foreground/90 sm:pr-14 sm:text-xl sm:leading-relaxed">
                <Bi text={doc.summary} />
              </blockquote>
            </figure>
          )}

          {/* Deciders */}
          {doc.deciders.length > 0 && (
            <section aria-labelledby="gac-deciders">
              <SectionHeading id="gac-deciders" icon={Target}>{t.deciders}</SectionHeading>
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {doc.deciders.map((d, i) => {
                  const player = d.playerId ? playersById[d.playerId] : undefined;
                  return (
                    <li key={i} className="relative flex flex-col gap-3 rounded-xl border bg-background p-4">
                      <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{String(i + 1).padStart(2, "0")}</span>
                      {player && (
                        <span className="absolute right-4 top-4"><PlayerAvatar player={player} side={sideOf(player.teamId)} size={48} /></span>
                      )}
                      <h4 className={cx("text-base font-semibold leading-snug tabular-nums", player && "pr-14")}><Bi text={d.title} /></h4>
                      <p className="text-sm leading-relaxed text-muted-foreground tabular-nums"><Bi text={d.text} /></p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Four Factors */}
          <section aria-labelledby="gac-ff">
            <SectionHeading id="gac-ff" icon={BarChart3}
              aside={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {(["home", "visitor"] as const).map((s) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span aria-hidden className={cx("h-2 w-4 rounded-full", ACCENT[s].bar)} />
                      {s === "home" ? home.name : visitor.name}
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />= {t.better}
                  </span>
                </div>
              }>
              {t.fourFactors}
            </SectionHeading>
            <div className="grid gap-x-10 gap-y-6 rounded-xl border bg-background p-4 sm:p-6 lg:grid-cols-2">
              {FACTORS.map((f) => (
                <FactorRow key={f.key} factor={f} home={fourFactors.home[f.key]} visitor={fourFactors.visitor[f.key]} />
              ))}
            </div>
          </section>

          {/* Team sections */}
          {teamSections.length > 0 && (
            <section aria-labelledby="gac-teams">
              <h3 id="gac-teams" className="sr-only">{t.teams}</h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {teamSections.map((s) => {
                  const side = sideOf(s.teamId);
                  const team = teamOf(s.teamId);
                  return (
                    <article key={s.teamId} className="overflow-hidden rounded-xl border bg-background">
                      <div aria-hidden className={cx("h-1", ACCENT[side].bar)} />
                      <div className="p-4 sm:p-6">
                        <header className="mb-5 flex items-center gap-3">
                          <TeamLogo team={team} side={side} size="md" />
                          <h4 className="text-lg font-semibold tracking-tight">{team.name}</h4>
                        </header>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <BulletBlock title={t.offense} icon={Swords} items={s.offense} side={side} />
                          <BulletBlock title={t.defense} icon={Shield} items={s.defense} side={side} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* Players */}
          {players.length > 0 && (
            <section aria-labelledby="gac-players">
              <SectionHeading id="gac-players" icon={Users}>{t.players}</SectionHeading>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {players.map((p) => {
                  const pl = playersById[p.playerId];
                  const side = sideOf(pl.teamId);
                  const v = VERDICT[p.verdict];
                  return (
                    <li key={p.playerId} className="flex gap-4 rounded-xl border bg-background p-4">
                      <PlayerAvatar player={pl} side={side} size={48} ringClass={v.ring} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 font-semibold leading-snug">
                            <span className="tabular-nums text-muted-foreground">#{pl.number}</span> {pl.name}
                          </p>
                          <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", v.pill)}>
                            <v.Icon aria-hidden className="size-3" />
                            {t.verdict[p.verdict]}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <TeamLogo team={teamOf(pl.teamId)} side={side} size="xs" />
                          <span className="truncate">{teamOf(pl.teamId).name}</span>
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground tabular-nums"><Bi text={p.text} /></p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Keys */}
          {keys.length > 0 && (
            <section aria-labelledby="gac-keys">
              <SectionHeading id="gac-keys" icon={ListChecks}>{t.keys}</SectionHeading>
              <div className={cx("grid gap-4", keys.length > 1 && "md:grid-cols-2")}>
                {keys.map((group, gi) => (
                  <div key={gi} className="rounded-xl border bg-background p-4 sm:p-6">
                    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                      <Crosshair aria-hidden className="size-4 text-muted-foreground" />
                      <Bi text={group.title} />
                    </h4>
                    <ol className="space-y-3">
                      {group.items.map((item, i) => (
                        <li key={i} className="flex gap-3">
                          <span aria-hidden className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-600 text-xs font-bold tabular-nums text-emerald-700 dark:border-emerald-400 dark:text-emerald-300">
                            {i + 1}
                          </span>
                          <span className="text-sm leading-relaxed sm:text-[15px]"><Bi text={item} /></span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Caveats */}
          {doc.caveats.length > 0 && (
            <details className="group rounded-lg border border-dashed bg-muted/30 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                <AlertTriangle aria-hidden className="size-4" />
                {t.caveats}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{doc.caveats.length}</span>
                <ChevronDown aria-hidden className="ml-auto size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="list-disc space-y-1.5 px-4 pb-4 pl-10 text-xs leading-relaxed sm:text-sm">
                {doc.caveats.map((c, i) => <li key={i}><Bi text={c} /></li>)}
              </ul>
            </details>
          )}
        </div>
      </section>
    </CardContext.Provider>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function ScoreTeam({ team, side, isWinner, align }: { team: AnalysisTeam; side: Side; isWinner: boolean; align: "start" | "end" }) {
  const { t } = useCard();
  return (
    <div className={cx("flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-4", align === "end" ? "sm:flex-row-reverse sm:text-right" : "sm:text-left")}>
      <TeamLogo team={team} side={side} size="lg" />
      <div className={cx("flex min-w-0 flex-col items-center gap-1", align === "end" ? "sm:items-end" : "sm:items-start")}>
        <p className={cx("line-clamp-2 text-sm font-semibold leading-tight sm:text-lg", isWinner ? "text-foreground" : "text-muted-foreground")}>{team.name}</p>
        <p className="text-[11px] text-muted-foreground">{side === "home" ? t.home : t.away}</p>
        {isWinner && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-emerald-500 dark:text-emerald-950">
            <Trophy aria-hidden className="size-3" />
            {t.won}
          </span>
        )}
      </div>
    </div>
  );
}

function FactorValue({ value, side, better, format }: { value: number; side: Side; better: Side | null; format: (v: number) => string }) {
  const { t } = useCard();
  return (
    <span className={cx("flex items-center gap-1 text-sm tabular-nums", side === "visitor" && "flex-row-reverse", better === side ? "font-bold text-foreground" : "text-muted-foreground")}>
      {format(value)}
      {better === side && (
        <>
          <Check aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="sr-only">({t.better})</span>
        </>
      )}
    </span>
  );
}

function FactorRow({ factor, home, visitor }: { factor: (typeof FACTORS)[number]; home: number; visitor: number }) {
  const { t, home: homeTeam, visitor: visitorTeam } = useCard();
  const better: Side | null = home === visitor ? null : (factor.lowerIsBetter ? home < visitor : home > visitor) ? "home" : "visitor";
  const max = Math.max(factor.max, home, visitor);
  const pct = (v: number) => `${Math.max(2, (v / max) * 100)}%`;
  const label = t[factor.label];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium">{label}</h4>
        {factor.lowerIsBetter && <span className="text-[11px] text-muted-foreground">{t.lowerBetter}</span>}
      </div>
      <div className="grid grid-cols-[4rem_1fr_1fr_4rem] items-center gap-2" role="group"
        aria-label={`${label}: ${homeTeam.name} ${factor.format(home)}, ${visitorTeam.name} ${factor.format(visitor)}`}>
        <FactorValue value={home} side="home" better={better} format={factor.format} />
        <div className="flex h-3 justify-end overflow-hidden rounded-l-full bg-muted">
          <div className={cx("h-full rounded-l-full", ACCENT.home.bar, better === "visitor" && "opacity-45")} style={{ width: pct(home) }} />
        </div>
        <div className="flex h-3 overflow-hidden rounded-r-full bg-muted">
          <div className={cx("h-full rounded-r-full", ACCENT.visitor.bar, better === "home" && "opacity-45")} style={{ width: pct(visitor) }} />
        </div>
        <FactorValue value={visitor} side="visitor" better={better} format={factor.format} />
      </div>
    </div>
  );
}

function BulletBlock({ title, icon: Icon, items, side }: { title: string; icon: typeof Swords; items: BiText[]; side: Side }) {
  if (!items.length) return null;
  return (
    <div>
      <h5 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
        {title}
      </h5>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed sm:text-[15px]">
            <span aria-hidden className={cx("mt-2 size-1.5 shrink-0 rounded-full", ACCENT[side].dot)} />
            <span><Bi text={item} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
