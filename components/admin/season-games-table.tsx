"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, FileBarChart2Icon, PencilIcon, SearchIcon, VideoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GameFormDialog } from "@/components/admin/game-form-dialog";
import { DeleteButton } from "@/components/admin/delete-button";
import { deleteGame } from "@/app/admin/(dashboard)/seasons/[id]/actions";
import { calendarDay, calendarTime } from "@/lib/club-event-calendar";
import { GAME_TYPES, type GameWithTeams, type Team } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SeasonGameRow = GameWithTeams & { eventCount: number };

type SortKey = "number" | "home" | "visitor" | "events";
type Status = "all" | "tagged" | "video" | "untagged";

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
const PAGE_SIZES = [10, 20, 50, 100];
const STATUS_LABELS: Record<Status, string> = { all: "Бүх төлөв", tagged: "Tag хийсэн", video: "Видеотой, tag хийгээгүй", untagged: "Видеогүй" };
const selectClass = "h-8 rounded-lg border border-input bg-background px-2 text-sm";
const typeLabel = (value: string) => GAME_TYPES.find((g) => g.value === value)?.label ?? value;
const weekday = (day: string) => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
const matchesStatus = (g: SeasonGameRow, status: Status) =>
  status === "all" ||
  (status === "tagged" && g.eventCount > 0) ||
  (status === "video" && !!g.video_url && g.eventCount === 0) ||
  (status === "untagged" && !g.video_url);

export function SeasonGamesTable({ seasonId, games, teams }: {
  seasonId: string;
  games: SeasonGameRow[];
  teams: Pick<Team, "id" | "name" | "logo_url">[];
}) {
  const [query, setQuery] = useState("");
  const [teamId, setTeamId] = useState("");
  const [gameType, setGameType] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "number", desc: false });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  // Fixed game number in chronological order (undated games last), stable across filters.
  const numbered = useMemo(() => {
    const ordered = [...games].sort((a, b) =>
      (a.game_date ?? "9999").localeCompare(b.game_date ?? "9999") || a.created_at.localeCompare(b.created_at));
    return ordered.map((game, i) => ({ game, number: i + 1 }));
  }, [games]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = numbered.filter(({ game }) =>
      (!teamId || game.home_team_id === teamId || game.visitor_team_id === teamId) &&
      (!gameType || game.game_type === gameType) &&
      matchesStatus(game, status) &&
      (!q || [game.home_team.name, game.visitor_team.name, game.location ?? ""].some((v) => v.toLowerCase().includes(q))));
    const value = ({ game, number }: (typeof numbered)[number]) =>
      sort.key === "home" ? game.home_team.name : sort.key === "visitor" ? game.visitor_team.name : sort.key === "events" ? game.eventCount : number;
    return filtered.sort((a, b) => {
      const av = value(a), bv = value(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "mn");
      return (sort.desc ? -cmp : cmp) || a.number - b.number;
    });
  }, [numbered, query, teamId, gameType, status, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const filtersActive = !!(query || teamId || gameType || status !== "all");
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  function sortHead(label: string, sortKey: SortKey, className?: string) {
    const active = sort.key === sortKey;
    const Icon = !active ? ChevronsUpDownIcon : sort.desc ? ArrowDownIcon : ArrowUpIcon;
    return <TableHead key={sortKey} className={className} aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort({ key: sortKey, desc: active ? !sort.desc : false })}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}<Icon className="size-3.5 opacity-60" />
      </button>
    </TableHead>;
  }

  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => resetPage(setQuery)(e.target.value)} placeholder="Баг, байршлаар хайх…" className="pl-8" aria-label="Тоглолт хайх" />
      </div>
      <select value={teamId} onChange={(e) => resetPage(setTeamId)(e.target.value)} className={selectClass} aria-label="Багаар шүүх">
        <option value="">Бүх баг</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={gameType} onChange={(e) => resetPage(setGameType)(e.target.value)} className={selectClass} aria-label="Төрлөөр шүүх">
        <option value="">Бүх төрөл</option>
        {GAME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <select value={status} onChange={(e) => resetPage(setStatus)(e.target.value as Status)} className={selectClass} aria-label="Төлөвөөр шүүх">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      {filtersActive && <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setTeamId(""); setGameType(""); setStatus("all"); setPage(0); }}>Цэвэрлэх</Button>}
      <span className="ml-auto text-sm text-muted-foreground">{rows.length} / {games.length} тоглолт</span>
    </div>

    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {sortHead("№", "number", "w-14")}
            <TableHead>Огноо</TableHead>
            <TableHead className="w-16">Цаг</TableHead>
            {sortHead("Home", "home")}
            <TableHead className="w-6 px-0 text-center text-muted-foreground">vs</TableHead>
            {sortHead("Visitor", "visitor")}
            <TableHead>Байршил</TableHead>
            <TableHead>Төрөл</TableHead>
            {sortHead("Төлөв", "events")}
            <TableHead className="w-36 text-right">Үйлдэл</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 && <TableRow>
            <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
              {games.length ? "Шүүлтүүрт тохирох тоглолт алга" : "Тоглолт үүсгэгдээгүй байна"}
            </TableCell>
          </TableRow>}
          {visible.map(({ game, number }) => {
            const day = game.game_date ? calendarDay(game.game_date) : null;
            return <TableRow key={game.id}>
              <TableCell className="font-mono text-muted-foreground tabular-nums">{number}</TableCell>
              <TableCell className="whitespace-nowrap">
                {day ? <><span className="tabular-nums">{day}</span> <span className="text-muted-foreground">· {weekday(day)}</span></> : <span className="text-muted-foreground">Товлоогүй</span>}
              </TableCell>
              <TableCell className="font-medium tabular-nums">{game.game_date ? calendarTime(game.game_date) : "—"}</TableCell>
              <TableCell className="font-medium">
                {game.home_team.name}
                {game.home_team_color && <span className="ml-1 text-xs text-muted-foreground">({game.home_team_color})</span>}
              </TableCell>
              <TableCell className="px-0 text-center text-xs text-muted-foreground">vs</TableCell>
              <TableCell className="font-medium">
                {game.visitor_team.name}
                {game.visitor_team_color && <span className="ml-1 text-xs text-muted-foreground">({game.visitor_team_color})</span>}
              </TableCell>
              <TableCell className="text-muted-foreground">{game.location ?? "—"}</TableCell>
              <TableCell><Badge variant="secondary">{typeLabel(game.game_type)}</Badge></TableCell>
              <TableCell>
                {game.eventCount > 0
                  ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{game.eventCount} event</Badge>
                  : game.video_url
                    ? <Badge variant="outline">Видеотой</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Link href={`/admin/tag/${game.id}`}>
                    <Button variant="ghost" size="icon-sm" title="Tag"><VideoIcon /><span className="sr-only">Tag</span></Button>
                  </Link>
                  <Link href={`/admin/tag/${game.id}/reports`}>
                    <Button variant="ghost" size="icon-sm" title="Reports"><FileBarChart2Icon /><span className="sr-only">Reports</span></Button>
                  </Link>
                  <GameFormDialog seasonId={seasonId} teams={teams} game={game}
                    trigger={<Button variant="ghost" size="icon-sm" title="Засах"><PencilIcon /><span className="sr-only">Засах</span></Button>} />
                  <DeleteButton action={deleteGame.bind(null, game.id, seasonId)} confirmText={`№${number} ${game.home_team.name} vs ${game.visitor_team.name} тоглолтыг устгах уу?`} />
                </div>
              </TableCell>
            </TableRow>;
          })}
        </TableBody>
      </Table>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        Хуудсанд
        <select value={pageSize} onChange={(e) => resetPage(setPageSize)(Number(e.target.value))} className={selectClass}>
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {rows.length ? `${currentPage * pageSize + 1}–${Math.min(rows.length, (currentPage + 1) * pageSize)}` : "0"} / {rows.length}
        </span>
        <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Өмнөх</Button>
        <span className="tabular-nums">{currentPage + 1} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Дараах</Button>
      </div>
    </div>
  </div>;
}
