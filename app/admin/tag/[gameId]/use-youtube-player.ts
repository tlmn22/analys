"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  getIframe(): HTMLIFrameElement;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return apiLoadPromise;
}

export function useYouTubePlayer(videoId: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { playsinline: 1, controls: 1, rel: 0 },
        events: {
          onReady: () => {
            const iframe = playerRef.current?.getIframe();
            iframe?.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
            if (!cancelled) setReady(true);
          },
          onStateChange: (e) => {
            if (!cancelled) setPlaying(e.data === window.YT!.PlayerState.PLAYING);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      setReady(false);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  // The YT.Player constructor returns an instance synchronously, but its
  // API methods aren't actually attached until the iframe finishes loading
  // and fires onReady — calling them before then can throw "not a
  // function". Every call here is guarded so a tag made moments after page
  // load can never throw out of an un-awaited commit() and silently vanish.
  const play = useCallback(() => {
    if (typeof playerRef.current?.playVideo === "function") playerRef.current.playVideo();
  }, []);
  const pause = useCallback(() => {
    if (typeof playerRef.current?.pauseVideo === "function") playerRef.current.pauseVideo();
  }, []);
  const mute = useCallback(() => {
    if (typeof playerRef.current?.mute === "function") playerRef.current.mute();
  }, []);
  const unmute = useCallback(() => {
    if (typeof playerRef.current?.unMute === "function") playerRef.current.unMute();
  }, []);
  const seekTo = useCallback((seconds: number) => {
    if (typeof playerRef.current?.seekTo === "function") {
      playerRef.current.seekTo(Math.max(0, seconds), true);
    }
  }, []);
  const setRate = useCallback((rate: number) => {
    if (typeof playerRef.current?.setPlaybackRate === "function") {
      playerRef.current.setPlaybackRate(rate);
    }
  }, []);
  const getCurrentTime = useCallback((): number => {
    return typeof playerRef.current?.getCurrentTime === "function"
      ? playerRef.current.getCurrentTime()
      : 0;
  }, []);

  const getDuration = useCallback(() => typeof playerRef.current?.getDuration === "function" ? playerRef.current.getDuration() : 0, []);
  return { containerRef, playing, ready, play, pause, mute, unmute, seekTo, setRate, getCurrentTime, getDuration };
}
