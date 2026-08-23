"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { extractVideoId } from "@/lib/youtube";
import { useYouTubePlayer } from "../use-youtube-player";
import type { ClipEvent } from "./clip-events";

const SPEEDS = [0.2, 0.5, 1, 3];
// Jump to a few seconds before the tagged moment so the lead-up to the play
// is visible too, not just the instant it was tagged.
const LEAD_IN_SECONDS = 5;

/** Video + clip-list drill-down modal — click any stat number across the
 * report pages to see exactly which tagged events produced it, with the
 * game video jumping to each one. `offenseClips`/`defenseClips` are
 * optional; when both are given, an Offense/Defense/All filter is shown
 * (used by the "Time" column, which lists everything that happened while
 * the player was on the floor). */
export function ClipModal({
  title,
  videoUrl,
  clips,
  offenseClips,
  defenseClips,
  onClose,
}: {
  title: string;
  videoUrl: string;
  clips: ClipEvent[];
  offenseClips?: ClipEvent[];
  defenseClips?: ClipEvent[];
  onClose: () => void;
}) {
  const videoId = extractVideoId(videoUrl);
  const { containerRef, play, pause, seekTo, setRate } = useYouTubePlayer(videoId);
  const [speed, setSpeed] = useState(1);
  const [filter, setFilter] = useState<"all" | "offense" | "defense">("all");
  const [activeIndex, setActiveIndex] = useState(0);

  const hasFilter = !!offenseClips || !!defenseClips;
  const clipsFor = (f: "all" | "offense" | "defense") =>
    f === "offense" && offenseClips ? offenseClips : f === "defense" && defenseClips ? defenseClips : clips;
  const visibleClips = clipsFor(filter);

  function seekToClip(videoTime: number) {
    seekTo(Math.max(0, videoTime - LEAD_IN_SECONDS));
  }

  useEffect(() => {
    if (clips.length > 0) seekToClip(clips[0].videoTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function changeFilter(f: "all" | "offense" | "defense") {
    setFilter(f);
    setActiveIndex(0);
    const next = clipsFor(f);
    if (next.length > 0) seekToClip(next[0].videoTime);
  }

  function playClip(i: number) {
    setActiveIndex(i);
    seekToClip(visibleClips[i].videoTime);
    play();
  }

  function playNext() {
    playClip(Math.min(visibleClips.length - 1, activeIndex + 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2" onClick={onClose}>
      <div
        className="flex h-[97vh] w-[98vw] flex-col overflow-hidden rounded-lg bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2">
          <span className="text-sm font-semibold">{title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XIcon className="size-4" />
          </button>
        </div>

        {hasFilter && (
          <div className="flex gap-4 border-b border-border px-4 py-1.5 text-xs">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={filter === "offense"} onChange={() => changeFilter("offense")} />
              Offense
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={filter === "defense"} onChange={() => changeFilter("defense")} />
              Defense
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={filter === "all"} onChange={() => changeFilter("all")} />
              All
            </label>
          </div>
        )}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border p-2">
            {visibleClips.length === 0 && <p className="p-2 text-sm text-muted-foreground">Event олдсонгүй.</p>}
            {visibleClips.map((c, i) => (
              <button
                key={c.id}
                onClick={() => playClip(i)}
                className={`mb-1 flex items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted ${
                  i === activeIndex ? "bg-muted" : ""
                }`}
              >
                <span className="font-mono text-blue-500">
                  Q{c.period} {c.scoreLabel} {c.clockLabel}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: c.badgeColor }}
                >
                  {c.label}
                </span>
              </button>
            ))}
            {visibleClips.length > 0 && (
              <button
                onClick={playNext}
                disabled={activeIndex >= visibleClips.length - 1}
                className="mt-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                ▶ Play Next Clip
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-black">
              {videoId ? (
                <div ref={containerRef} className="absolute inset-0 h-full w-full" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  YouTube URL олдсонгүй
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={() => play()}
                className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500"
              >
                ▶ Play
              </button>
              <button onClick={() => pause()} className="rounded-md border border-border px-3 py-1.5 text-xs">
                ❚❚ Pause
              </button>
              {SPEEDS.map((sp) => (
                <button
                  key={sp}
                  onClick={() => {
                    setSpeed(sp);
                    setRate(sp);
                  }}
                  className={`rounded-md px-2 py-1 text-xs ${
                    sp === speed ? "bg-blue-600 text-white" : "border border-border"
                  }`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
