"use client";

import { useState, type ReactNode } from "react";
import "./package-viewer.css";
import Link from "next/link";
import { extractVideoId } from "@/lib/youtube";
import { TrackedPackageVideo } from "@/components/player/tracked-package-video";
import { EDITABLE_EVENTS } from "@/lib/tag-events";

export type PackageClip = {
  id: string; lead_seconds: number; trail_seconds: number;
  event: { id: string; event_type: string; period: number; clock_time: number; video_time: number; game_id: string;
    game: { video_url: string | null } | null; player: { first_name: string; last_name: string } | null } | null;
};
export function PackageViewer({ clips, showReports = true, membersPanel, trackViews = false }: { clips: PackageClip[]; showReports?: boolean; membersPanel?: ReactNode; trackViews?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [replay, setReplay] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  function choose(index: number) { setSelected(index); setReplay(value => value + 1); setAutoplay(true); }
  const current = clips[selected];
  const event = current?.event;
  const videoId = event?.game?.video_url ? extractVideoId(event.game.video_url) : null;
  const label = (item: PackageClip) => EDITABLE_EVENTS.find(def => def.type === item.event?.event_type)?.label ?? item.event?.event_type ?? "Event олдсонгүй";
  if (!clips.length) return <div className={`pv-container ${!showReports && !membersPanel ? "pv-recipient" : ""}`}><div className={`pv-layout ${membersPanel ? "pv-three" : ""}`}>
    {membersPanel && <aside className="pv-members" aria-label="Багийн гишүүд">{membersPanel}</aside>}
    <section className="pv-video rounded-xl border bg-card p-4"><h2 className="font-semibold">Бичлэг</h2><p className="py-16 text-center text-muted-foreground">Багцад event байхгүй байна.</p></section>
    <section className="pv-events rounded-xl border bg-card p-4"><h2 className="font-semibold">Event-үүд · 0</h2></section>
  </div></div>;
  return <div className={`pv-container ${!showReports && !membersPanel ? "pv-recipient" : ""}`}><div className={`pv-layout ${membersPanel ? "pv-three" : ""}`}>
    {membersPanel && <aside className="pv-members" aria-label="Багийн гишүүд">{membersPanel}</aside>}
    <section className="pv-events rounded-xl border bg-card"><h2 className="border-b p-4 text-sm font-semibold">Event-үүд <span className="text-muted-foreground">· {clips.length}</span></h2><div className="pv-event-list max-h-[70vh] space-y-2 overflow-auto p-3" tabIndex={0} aria-label="Event-ийн жагсаалт">{clips.map((clip, index) => <button key={clip.id} type="button" onClick={() => choose(index)} aria-pressed={selected === index} className={`block w-full rounded-lg border p-3 text-left text-sm ${selected === index ? "border-emerald-600 bg-emerald-500/10" : "hover:bg-muted"}`}><span className="font-semibold">{index + 1}. {label(clip)}</span><span className="mt-1 block text-xs text-muted-foreground">{clip.event?.player ? `${clip.event.player.last_name} ${clip.event.player.first_name}` : "Багийн event"} · Q{clip.event?.period}</span></button>)}</div></section>
    <section className="pv-video min-w-0 space-y-3 rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">Бичлэг <span className="ml-2 text-muted-foreground">{selected + 1} / {clips.length}</span></h2>
      <div className="pv-screen aspect-video overflow-hidden rounded-xl bg-black">{videoId && event ? trackViews ? <TrackedPackageVideo key={`${current.id}:${replay}`} itemId={current.id} videoId={videoId} start={Math.max(0, Number(event.video_time) - current.lead_seconds)} end={Number(event.video_time) + current.trail_seconds} autoplay={autoplay} /> : <iframe key={`${current.id}:${replay}`} title={label(current)} className="h-full w-full" src={`https://www.youtube.com/embed/${videoId}?start=${Math.max(0, Math.floor(Number(event.video_time) - current.lead_seconds))}&end=${Math.ceil(Number(event.video_time) + current.trail_seconds)}&rel=0&playsinline=1&autoplay=${autoplay ? 1 : 0}&mute=${autoplay ? 1 : 0}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <p className="p-8 text-center text-sm text-white">Энэ event-ийн YouTube бичлэг олдсонгүй.</p>}</div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" disabled={selected === 0} onClick={() => choose(selected - 1)} className="rounded border px-3 py-2 disabled:opacity-40">← Өмнөх</button><button type="button" onClick={() => choose(selected)} className="rounded border px-3 py-2">Дахин үзэх</button><button type="button" disabled={selected === clips.length - 1} onClick={() => choose(selected + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Дараах →</button>{event && showReports && <Link className="text-emerald-600 hover:underline" href={`/admin/tag/${event.game_id}/reports`}>Тоглолтын Reports ↗</Link>}</div>
      <p className="text-xs text-muted-foreground">{current.lead_seconds} секунд өмнө · {current.trail_seconds} секунд дараа</p>
    </section>
  </div></div>;
}
