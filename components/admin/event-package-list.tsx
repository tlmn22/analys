"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, PlusIcon, PlayIcon, ArrowUpRightIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createEmptyEventPackage } from "@/app/admin/event-package-actions";
import "./event-package-list.css";

export type PackageSummary = { id: string; name: string; description: string; created_at: string; event_package_items: { count: number }[] };
function Court({ hero = false }: { hero?: boolean }) {
  return <svg className={hero ? "eb-hero-court" : "court"} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="8" y="8" width="304" height="164" rx="3" /><line x1="160" y1="8" x2="160" y2="172" /><circle cx="160" cy="90" r="26" /><rect x="8" y="58" width="58" height="64" /><circle cx="66" cy="90" r="18" /><path d="M8 20 H30 A84 84 0 0 1 30 160 H8" /><rect x="254" y="58" width="58" height="64" /><circle cx="254" cy="90" r="18" /><path d="M312 20 H290 A84 84 0 0 0 290 160 H312" /></svg>;
}
const clips = (item: PackageSummary) => item.event_package_items?.[0]?.count ?? 0;
const date = (value: string) => value.slice(0, 10).replaceAll("-", ".");
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function EventPackageList({ packages, canManage = true }: { packages: PackageSummary[]; canManage?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filtered = packages.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => {
    const order = sort === "clips" ? clips(b) - clips(a) : sort === "name" ? compareText(a.name.toLowerCase(), b.name.toLowerCase()) : compareText(b.created_at, a.created_at);
    return order || compareText(a.id, b.id);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages);
  const newest = packages.reduce((latest, item) => item.created_at > latest ? item.created_at : latest, "");
  async function create() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await createEmptyEventPackage(name, description);
      if (result.error) { setError(result.error); return; }
      setOpen(false); router.push(`/admin/event-packages/${result.id}`); router.refresh();
    } catch { setError("Багц үүсгэж чадсангүй. Дахин оролдоно уу."); }
    finally { setBusy(false); }
  }
  function startCreate() { setError(""); setOpen(true); }
  return <div className="eb-shell"><div className="eb">
    <header className="eb-hero"><Court hero /><div className="eb-hero-content"><div className="eb-eyebrow"><span className="eb-rec" />Scouting · бичлэг</div><h1>Videos</h1><p>Тоглолтын event бичлэгүүдийг багцаар нь үзэх</p></div><div className="eb-stats"><span className="eb-chip"><b>{packages.length}</b><span>багц</span></span><span className="eb-chip"><b>{packages.reduce((sum, item) => sum + clips(item), 0)}</b><span>багц дахь бичлэг</span></span>{newest && <span className="eb-chip"><span>Сүүлд нэмсэн</span><b>{date(newest)}</b></span>}</div></header>
    <div className="eb-bar"><label className="eb-search"><SearchIcon className="size-4 shrink-0" /><input aria-label="Багц хайх" placeholder="Багц хайх" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label><div className="eb-seg" role="group" aria-label="Эрэмбэ">{[["new", "Шинэ"], ["clips", "Их бичлэгтэй"], ["name", "А–Я"]].map(([value, label]) => <button type="button" key={value} aria-pressed={sort === value} onClick={() => { setSort(value); setPage(1); }}>{label}</button>)}</div>{canManage && <button type="button" className="eb-btn" onClick={startCreate}><PlusIcon className="size-4" />Шинэ багц</button>}</div>
    {!filtered.length && <p className="eb-empty">{packages.length ? "Хайлтанд тохирох багц олдсонгүй." : canManage ? "Одоогоор багц байхгүй. Шинэ багц үүсгээд Reports-ийн event modal-аас бичлэг нэмээрэй." : "Танай клубт бичлэг хуваарилаагүй байна."}</p>}
    <div className="eb-grid">{filtered.slice((current - 1) * 12, current * 12).map(item => <Link key={item.id} href={`/admin/event-packages/${item.id}`} className="eb-card" aria-label={`${item.name}, ${clips(item)} бичлэг`}><div className="eb-thumb"><div className="eb-poster"><Court /><span className="eb-badge tl"><span className="eb-rec" />{clips(item)} бичлэг</span><div className="eb-strip" aria-hidden="true">{Array.from({ length: Math.min(clips(item), 7) }, (_, i) => <i key={i} />)}</div><span className="eb-badge br">{date(item.created_at)}</span><span className="eb-play"><PlayIcon className="size-6 fill-current" /></span></div></div><div className="eb-meta"><span className="eb-av" aria-hidden="true">{item.name.trim().slice(0, 1).toUpperCase()}</span><div><h3>{item.name}</h3><p className={`eb-description ${item.description ? "" : "empty"}`}>{item.description || "Тайлбар нэмээгүй"}</p></div><ArrowUpRightIcon className="size-4 mt-1" aria-hidden="true" /></div></Link>)}<button type="button" className="eb-new" onClick={startCreate}><span><PlusIcon className="size-5" /></span><span>Шинэ багц үүсгэх</span></button></div>
    <div className="eb-foot"><button type="button" disabled={current === 1} onClick={() => setPage(current - 1)}>← Өмнөх</button><span>Хуудас</span><b>{current}</b><span>/ {pages}</span><button type="button" disabled={current === pages} onClick={() => setPage(current + 1)}>Дараах →</button></div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Шинэ багц үүсгэх</DialogTitle><DialogDescription>Багцаа үүсгээд Reports-ийн event үзэх хэсгээс бичлэгүүдээ нэмнэ.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); void create(); }}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Багцын нэр<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><label className="block text-sm">Тайлбар<textarea maxLength={2000} rows={3} value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-2" /></label><button type="submit" disabled={!name.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Үүсгэж байна…" : "Багц үүсгэх"}</button></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form></DialogContent></Dialog>
  </div></div>;
}
