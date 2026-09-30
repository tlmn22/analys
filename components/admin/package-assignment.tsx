"use client";

import { useState } from "react";
import { assignPackage, loadPackageRecipients, unassignPackage } from "@/app/admin/package-assignment-actions";

const roles: Record<string, string> = { player: "Тоглогч", owner: "Эзэмшигч", manager: "Менежер", head_coach: "Ахлах дасгалжуулагч", assistant_coach: "Туслах дасгалжуулагч" };
type Recipients = Extract<Awaited<ReturnType<typeof loadPackageRecipients>>, { members: unknown }>;
export function PackageAssignment({ packageId, initialData, initialError = "" }: { packageId: string; initialData?: Recipients; initialError?: string }) {
  const [data, setData] = useState<Recipients | null>(initialData ?? null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { const result = await loadPackageRecipients(packageId); if (result.error) setError(result.error); else if (result.members) setData(result); }
    catch { setError("Гишүүдийг ачаалж чадсангүй."); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const ids = [...selected];
      const result = await assignPackage(packageId, ids);
      if (result.error) { setError(result.error); return; }
      setData(previous => previous ? { ...previous, assigned: [...new Set([...previous.assigned, ...ids])] } : previous);
      setSelected(new Set()); setMessage(`${result.added} гишүүнд шинээр хуваариллаа.`);
    } catch { setError("Хуваарилж чадсангүй. Дахин оролдоно уу."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm("Энэ гишүүний багц үзэх эрхийг цуцлах уу?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await unassignPackage(packageId, id);
      if (result.error) { setError(result.error); return; }
      setData(previous => previous ? { ...previous, assigned: previous.assigned.filter(member => member !== id) } : previous);
      setMessage("Хуваарилалтыг цуцаллаа.");
    } catch { setError("Цуцалж чадсангүй."); }
    finally { setBusy(false); }
  }
  const visible = data?.members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const groups = [
    { title: "Тоглогчид", members: visible.filter(m => m.role === "player") },
    { title: "Дасгалжуулагчид", members: visible.filter(m => ["head_coach", "assistant_coach"].includes(m.role)) },
    { title: "Бусад ажилтнууд", members: visible.filter(m => !["player", "head_coach", "assistant_coach"].includes(m.role)) },
  ];
  const available = visible.filter(m => !data?.assigned.includes(m.id));
  return <section className="rounded-xl border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Тоглогчид, дасгалжуулагчид</h2><p className="mt-1 text-xs text-muted-foreground">Нэг багцыг олон гишүүнд хуваарилж болно.{data && ` Нийт ${data.assigned.length} гишүүнд хуваарилсан.`}</p></div><button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">{data ? "Шинэчлэх" : "Гишүүд сонгох"}</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-600">{message}</p>}
    {data && <fieldset disabled={busy} className="mt-4 space-y-3">
      <div className="grid gap-2"><input aria-label="Гишүүн хайх" placeholder="Нэрээр хайх" value={search} onChange={e => setSearch(e.target.value)} className="rounded border bg-background p-2 text-sm" /></div>
      <div className="flex flex-wrap gap-4 text-xs"><button type="button" onClick={() => setSelected(previous => new Set([...previous, ...available.map(m => m.id)]))} className="underline">Харагдаж буй бүх гишүүнийг сонгох</button><button type="button" onClick={() => setSelected(new Set())} className="underline">Сонголт цэвэрлэх</button><span>{selected.size} сонгосон (бүх клубын нийлбэр)</span></div>
      <div className="max-h-[50vh] overflow-auto divide-y rounded border">{groups.filter(group => group.members.length > 0).map(group => <section key={group.title}><h3 className="bg-muted px-3 py-2 text-xs font-semibold">{group.title} · {group.members.length}</h3>{group.members.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><label className="flex min-w-0 items-center gap-3"><input type="checkbox" disabled={data.assigned.includes(m.id)} checked={data.assigned.includes(m.id) || selected.has(m.id)} onChange={e => setSelected(previous => { const next = new Set(previous); if (e.target.checked) next.add(m.id); else next.delete(m.id); return next; })} /><span>{m.first_name} {m.last_name}<span className="block text-xs text-muted-foreground">{roles[m.role] ?? m.role} · {data.clubs.find(c => c.id === m.club_id)?.name}</span></span></label>{data.assigned.includes(m.id) && <button type="button" onClick={() => void remove(m.id)} className="shrink-0 text-xs text-destructive">Хуваарилсан · Цуцлах</button>}</div>)}</section>)}{!visible.length && <p className="p-4 text-sm text-muted-foreground">Гишүүн олдсонгүй.</p>}</div>
      <button type="button" disabled={!selected.size || selected.size > 1000} onClick={() => void save()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Хадгалж байна…" : `${selected.size} гишүүнд хуваарилах`}</button>
    </fieldset>}
  </section>;
}
