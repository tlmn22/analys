"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractVideoId } from "@/lib/youtube";
import { useYouTubePlayer } from "./use-youtube-player";

const PERIOD_START_SECONDS = 10 * 60;

const SPEEDS = [0.2, 0.5, 1, 3];
const NUDGES: [number, string][] = [
  [-10, "-10"],
  [-1, "-1"],
  [3, "+3"],
  [10, "+10"],
  [30, "+30"],
  [600, "+10:00"],
];

export function fmtClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenths = Math.floor((s * 10) % 10);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${tenths}`;
}

export interface VideoPanelHandle {
  getSnapshot: () => { clockTime: number; videoTime: number };
  seekTo: (seconds: number) => void;
  pause: () => void;
  play: () => void;
  isPlaying: () => boolean;
  isReady: () => boolean;
  setClock: (seconds: number) => void;
  /** Called when "End Quarter" is tagged — the game clock otherwise stays
   * wherever it was left (usually near 0:00), silently corrupting every
   * event's clock_time for the next period if nobody retypes it by hand. */
  resetClock: () => void;
}

export const VideoPanel = forwardRef<
  VideoPanelHandle,
  { videoUrl: string; live: boolean; initialClockTime?: number; initialVideoTime?: number }
>(function VideoPanel({ videoUrl, live, initialClockTime, initialVideoTime }, ref) {
    const videoId = extractVideoId(videoUrl);
    const { containerRef, playing, ready, play, pause, seekTo, setRate, getCurrentTime } =
      useYouTubePlayer(videoId);
    const [speed, setSpeed] = useState(1);
    const [gameClock, setGameClock] = useState(initialClockTime ?? PERIOD_START_SECONDS);
    const [clockInput, setClockInput] = useState(fmtClock(initialClockTime ?? PERIOD_START_SECONDS));
    const resumedRef = useRef(false);

    // Reopening a game mid-tagging resumes video playback from where the
    // last event was tagged — only once per mount, and only once the
    // player actually reports ready (seeking earlier is a silent no-op).
    useEffect(() => {
      if (ready && !resumedRef.current && initialVideoTime) {
        resumedRef.current = true;
        seekTo(initialVideoTime);
      }
    }, [ready, initialVideoTime, seekTo]);

    useEffect(() => {
      // The game clock only runs while the video is actually playing AND
      // "Start Action" is active — pressing "Stop Action" (timeout, foul,
      // substitution, ...) freezes the clock even if the video keeps
      // rolling (replays, referee review, broadcast doesn't pause).
      const id = setInterval(() => {
        if (playing && live) setGameClock((c) => Math.max(0, c - 0.2 * speed));
      }, 200);
      return () => clearInterval(id);
    }, [playing, live, speed]);

    useEffect(() => {
      setClockInput(fmtClock(gameClock));
    }, [gameClock]);

    useImperativeHandle(
      ref,
      () => ({
        getSnapshot: () => ({ clockTime: gameClock, videoTime: getCurrentTime() }),
        seekTo,
        pause,
        play,
        isPlaying: () => playing,
        isReady: () => ready,
        setClock: setGameClock,
        resetClock: () => setGameClock(PERIOD_START_SECONDS),
      }),
      [gameClock, getCurrentTime, seekTo, pause, play, playing, ready]
    );

    function applyClockInput() {
      const m = clockInput.match(/^(\d+):(\d+(?:\.\d+)?)$/);
      if (m) setGameClock(Math.max(0, parseFloat(m[1]) * 60 + parseFloat(m[2])));
      else setClockInput(fmtClock(gameClock));
    }

    function nudge(delta: number) {
      seekTo(getCurrentTime() + delta);
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-2.5 p-3">
        <div className="relative flex-1 overflow-hidden rounded-md border border-border bg-black">
          {videoId ? (
            <div ref={containerRef} className="absolute inset-0 h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              YouTube URL олдсонгүй
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => (playing ? pause() : play())}
            className={playing ? "" : "bg-orange-600 text-white hover:bg-orange-500"}
          >
            {playing ? "❚❚ Pause" : "▶ Play"}
          </Button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Clock:</span>
            <Input
              value={clockInput}
              onChange={(e) => setClockInput(e.target.value)}
              onBlur={applyClockInput}
              onKeyDown={(e) => e.key === "Enter" && applyClockInput()}
              className="h-8 w-20 font-mono"
            />
          </div>

          <div className="flex gap-1">
            {SPEEDS.map((sp) => (
              <Button
                key={sp}
                variant={sp === speed ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSpeed(sp);
                  setRate(sp);
                }}
              >
                {sp}x
              </Button>
            ))}
          </div>

          <div className="flex gap-1">
            {NUDGES.map(([delta, label]) => (
              <Button key={label} variant="outline" size="sm" onClick={() => nudge(delta)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
