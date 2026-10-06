"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  MAX_ACTIVITY_BATCH,
  MAX_TARGET_LENGTH,
  parseReportPath,
  type ReportActivityEvent,
} from "@/lib/report-activity";

const ENDPOINT = "/api/report-activity";
const FLUSH_MS = 5000;
const INTERACTIVE =
  "a,button,[role=button],[role=tab],[role=menuitem],[role=option],[role=checkbox],input,select,textarea,label,summary";

const clean = (text: string | null | undefined, max = 80) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Human-readable click target: nearest heading › table row › column › control text. */
function describe(start: Element): string {
  const control = start.closest(INTERACTIVE);
  const el = control ?? start;
  let own = clean(el.getAttribute("aria-label") || el.getAttribute("title"));
  if (!own && el instanceof HTMLInputElement) own = clean(`${el.type} ${el.name || el.placeholder || el.value}`);
  if (!own && el instanceof HTMLSelectElement) own = clean(el.selectedOptions[0]?.text);
  // Big containers have expensive, meaningless innerText.
  if (!own && (control || el.childElementCount <= 3)) own = clean((el as HTMLElement).innerText);
  if (!own) own = el.tagName.toLowerCase();

  const parts: string[] = [];
  for (let node = el.parentElement, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
    const heading = node.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > div > h2, :scope > div > h3");
    if (heading && !heading.contains(el)) {
      parts.push(clean(heading.textContent, 60));
      break;
    }
  }
  const cell = el.closest("td,th") as HTMLTableCellElement | null;
  if (cell) {
    const row = cell.parentElement as HTMLTableRowElement | null;
    const rowLabel = row && row.cells[0] !== cell ? clean(row.cells[0]?.innerText, 40) : "";
    const column = clean(cell.closest("table")?.tHead?.rows[0]?.cells[cell.cellIndex]?.innerText, 40);
    if (rowLabel) parts.push(rowLabel);
    if (column && column !== own) parts.push(column);
  }
  parts.push(own);
  return parts.filter(Boolean).join(" › ").slice(0, MAX_TARGET_LENGTH);
}

/** Logs report page views (with visible time) and every click for club staff. */
export function ReportActivityTracker() {
  const pathname = usePathname();
  const queue = useRef<ReportActivityEvent[]>([]);
  const gameId = useRef<string | null>(null);
  const view = useRef<{ id: string; slug: string; visibleMs: number; visibleSince: number | null } | null>(null);

  function send(useBeacon: boolean) {
    const id = gameId.current;
    if (!id) return;
    while (queue.current.length) {
      const body = JSON.stringify({ gameId: id, events: queue.current.splice(0, MAX_ACTIVITY_BATCH) });
      if (useBeacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) continue;
      void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    }
  }

  function endView() {
    const current = view.current;
    if (!current) return;
    const now = Date.now();
    const visibleMs = current.visibleMs + (current.visibleSince === null ? 0 : now - current.visibleSince);
    view.current = null;
    // Drop blink views (StrictMode double effects, instant redirects) that haven't been sent yet.
    const unsent = queue.current.some((e) => e.viewId === current.id && e.action === "view");
    if (visibleMs < 500 && unsent) {
      queue.current = queue.current.filter((e) => e.viewId !== current.id);
      return;
    }
    queue.current.push({ viewId: current.id, slug: current.slug, action: "leave", durationSeconds: visibleMs / 1000, at: now });
  }

  function startView(slug: string) {
    const now = Date.now();
    view.current = { id: crypto.randomUUID(), slug, visibleMs: 0, visibleSince: document.visibilityState === "visible" ? now : null };
    queue.current.push({ viewId: view.current.id, slug, action: "view", at: now });
  }

  // One view per report page; navigating between reports closes the previous one.
  useEffect(() => {
    const parsed = parseReportPath(pathname);
    if (!parsed) return;
    if (gameId.current && gameId.current !== parsed.gameId) {
      endView();
      send(false);
    }
    gameId.current = parsed.gameId;
    startView(parsed.slug);
    return () => endView();
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const current = view.current;
      if (!current || !(e.target instanceof Element)) return;
      queue.current.push({ viewId: current.id, slug: current.slug, action: "click", target: describe(e.target), at: Date.now() });
      if (queue.current.length >= MAX_ACTIVITY_BATCH) send(false);
    }
    function onVisibility() {
      const current = view.current;
      if (!current) return;
      if (document.visibilityState === "hidden") {
        if (current.visibleSince !== null) current.visibleMs += Date.now() - current.visibleSince;
        current.visibleSince = null;
        send(true);
      } else if (current.visibleSince === null) {
        current.visibleSince = Date.now();
      }
    }
    function onPageHide() {
      const slug = view.current?.slug;
      endView();
      send(true);
      // Restored from the back/forward cache: open a fresh view.
      window.addEventListener("pageshow", (ev) => { if (ev.persisted && slug !== undefined) startView(slug); }, { once: true });
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const timer = window.setInterval(() => send(false), FLUSH_MS);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(timer);
      endView();
      send(false);
    };
  }, []);

  return null;
}
