"use client";

import { useState } from "react";
import { FolderPlusIcon } from "lucide-react";
import { addEventsToPackage, createEventPackageWithEvents, listEventPackages } from "@/app/admin/event-package-actions";

export function EventPackagePicker({ eventId, eventIds, label, onBusyChange }: { eventId?: string; eventIds?: string[]; label: string; onBusyChange?: (busy: boolean) => void }) {
  const ids = eventIds ?? (eventId ? [eventId] : []);
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<{ id: string; name: string; description: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    setOpen(true); setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      const result = await listEventPackages();
      if (result.error) { setError(result.error); return; }
      setPackages(result.packages); setSelected(result.packages[0]?.id ?? "");
      setCreating(result.packages.length === 0); setLoaded(true);
    } catch { setError("Багцуудыг ачаалж чадсангүй. Дахин оролдоно уу."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  async function save() {
    if (busy) return;
    setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    try {
      const result = creating ? await createEventPackageWithEvents(name, description, ids) : await addEventsToPackage(selected, ids);
      if (result.error) { setError(result.error); return; }
      setMessage(`${result.added} event нэмэгдлээ.${result.skipped ? ` ${result.skipped} event өмнө нь нэмэгдсэн байна.` : ""}`);
      setOpen(false); setLoaded(false); setName(""); setDescription("");
    } catch { setError("Хадгалж чадсангүй. Дахин оролдоно уу."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="shrink-0 rounded-lg border border-emerald-600/25 p-3">
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy || !ids.length} onClick={() => open ? setOpen(false) : void load()} aria-expanded={open} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><FolderPlusIcon className="size-4" />Багцад нэмэх</button><span className="text-xs text-muted-foreground">{label}</span></div>
    {message && <p role="status" className="mt-2 text-sm text-emerald-600">{message}</p>}
    {open && <form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <p className="text-xs text-muted-foreground">Сонгосон {ids.length} event · өмнөх 7 + дараах 7 секунд · Видео файл үүсгэхгүй</p>
      {busy && <p role="status" className="text-xs">Түр хүлээнэ үү…</p>}
      {loaded && <fieldset disabled={busy} className="space-y-3">
        <div className="flex gap-2"><button type="button" aria-pressed={!creating} onClick={() => setCreating(false)} className={`rounded border px-3 py-1 text-xs ${!creating ? "bg-muted" : ""}`}>Байгаа багц</button><button type="button" aria-pressed={creating} onClick={() => setCreating(true)} className={`rounded border px-3 py-1 text-xs ${creating ? "bg-muted" : ""}`}>+ Шинэ багц үүсгэх</button></div>
        {creating ? <><label className="block text-xs">Багцын нэр<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Жишээ: LeBron — хамгаалалтын scout" className="mt-1 block w-full rounded border bg-background p-2 text-sm" /></label><label className="block text-xs">Тайлбар (заавал биш)<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 block w-full rounded border bg-background p-2 text-sm" /></label></> : <label className="block text-xs">Багц сонгох<select required value={selected} onChange={e => setSelected(e.target.value)} className="mt-1 block w-full rounded border bg-background p-2 text-sm"><option value="" disabled>Багц сонгоно уу</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{!packages.length && <span>Багц алга. Шинэ багц үүсгэнэ үү.</span>}</label>}
        <button type="submit" disabled={creating ? !name.trim() : !selected} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{creating ? "Багц үүсгээд event нэмэх" : "Сонгосон багцад нэмэх"}</button>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loaded && !busy && <button type="button" onClick={() => void load()} className="text-sm underline">Дахин ачаалах</button>}
    </form>}
  </div>;
}
