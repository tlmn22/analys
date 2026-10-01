"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(error => console.error("HoopsLab service worker registration failed", error));
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem("hoopslab-install-dismissed") === "1"; } catch {}
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // Browser capabilities are checked after hydration only.
    const timer = window.setTimeout(() => { setIos(isIos); setHidden(!!standalone || dismissed); }, 0);
    const install = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => { setPrompt(null); setHidden(true); };
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true); setError("");
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === "accepted") setHidden(true);
    } catch { setError("Browser-ийн цэснээс Install app / Add to Home Screen сонгоорой."); }
    finally { setPrompt(null); setBusy(false); }
  }
  if (hidden || (!ios && !prompt && !error)) return null;
  return <aside aria-label="HoopsLab суулгах" className="flex flex-wrap items-center justify-between gap-3 border-b bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
    <div><p className="font-semibold">HoopsLab-ийг утсандаа суулгах</p>
      {ios && !prompt && <p>Safari-ийн Share → Add to Home Screen сонгоорой.</p>}
      {error && <p role="status">{error}</p>}
    </div>
    <div className="flex gap-3">
      {prompt && <button type="button" disabled={busy} onClick={() => void install()} className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Түр хүлээнэ үү…" : "Суулгах"}</button>}
      <button type="button" aria-label="Суулгах сануулгыг хаах" onClick={() => { setHidden(true); try { sessionStorage.setItem("hoopslab-install-dismissed", "1"); } catch {} }} className="rounded-lg px-3 py-2 hover:bg-emerald-500/10">Дараа</button>
    </div>
  </aside>;
}
