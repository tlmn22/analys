"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, FilmIcon, CalendarDaysIcon } from "lucide-react";

export function PlayerNav() {
  const pathname = usePathname();
  return <nav aria-label="Гишүүний цэс" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}><div className="mx-auto grid max-w-6xl grid-cols-3 gap-1 px-2 py-1">
    {[{ href: "/player", label: "Нүүр", icon: HomeIcon }, { href: "/my-packages", label: "Бичлэг", icon: FilmIcon }, { href: "/player/schedule", label: "Calendar", icon: CalendarDaysIcon }].map(item => {
      const active = item.href === "/player" ? pathname === item.href : pathname.startsWith(item.href);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-medium sm:text-sm ${active ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300" : "text-muted-foreground hover:bg-muted"}`}><item.icon className="size-5" />{item.label}</Link>;
    })}
  </div></nav>;
}
