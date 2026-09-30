"use client";
import { useEffect, useRef, useState } from "react";
import { useYouTubePlayer } from "@/app/admin/tag/[gameId]/use-youtube-player";
import { recordPackageView } from "@/app/package-view-actions";
import { addPlaybackInterval } from "@/lib/playback-coverage";

export function TrackedPackageVideo({ itemId, videoId, start, end, autoplay }: { itemId: string; videoId: string; start: number; end: number; autoplay: boolean }) {
  const { containerRef, ready, playing, seekTo, play, pause, getCurrentTime, getDuration } = useYouTubePlayer(videoId);
  const intervals = useRef<[number, number][]>([]);
  const run = useRef("");
  const saved = useRef(0);
  const pending = useRef(false);
  const done = useRef(false);
  const [status, setStatus] = useState("");
  useEffect(() => { if (ready) { seekTo(start); if (autoplay) play(); } }, [ready, start, autoplay, seekTo, play]);
  useEffect(() => {
    if (!ready) return;
    let previous: { time: number; wall: number } | null = null;
    const timer = setInterval(() => {
      const time = getCurrentTime();
      const duration = Math.max(0, Math.min(end, getDuration() || end) - start);
      const wall = performance.now();
      if (playing && document.visibilityState === "visible") {
        if (previous) {
          const delta = time - previous.time;
          // Ignore jumps from seeking; support normal playback speeds up to 2x.
          if (delta > 0 && delta <= (wall - previous.wall) / 1000 * 2.2 + .15) {
            intervals.current = addPlaybackInterval(intervals.current, Math.max(start, previous.time), Math.min(start + duration, time));
          }
        }
        previous = { time, wall };
      } else previous = null;
      if (time >= start + duration && duration > 0) pause();
      const watched = intervals.current.reduce((sum, [a, b]) => sum + b - a, 0);
      const completed = duration > 0 && watched >= duration * .8;
      if (watched > 0 && !pending.current && !done.current && (saved.current === 0 || watched - saved.current >= 2 || completed)) {
        run.current ||= crypto.randomUUID();
        pending.current = true;
        void recordPackageView(itemId, run.current, watched, duration).then(result => {
          if (result.error) { setStatus("Үзэлт хадгалагдаагүй. Дахин оролдож байна…"); return; }
          saved.current = watched; done.current = !!result.completed;
          setStatus(result.completed ? "Үзсэн · Хадгалагдлаа" : "Үзэж эхэлсэн");
        }).catch(() => setStatus("Үзэлт хадгалагдаагүй. Дахин оролдож байна…")).finally(() => { pending.current = false; });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready, playing, start, end, itemId, getCurrentTime, getDuration, pause]);
  return <div className="relative h-full w-full"><div ref={containerRef} className="h-full w-full" />{status && <span role="status" className="pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] text-white">{status}</span>}</div>;
}
