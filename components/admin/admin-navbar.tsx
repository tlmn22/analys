"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { SearchIcon, MoonIcon, SunIcon, ChevronDownIcon, LogOutIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { logout } from "@/app/admin/actions";
import { navItems, clubNavItems } from "./sidebar-nav";

export function AdminNavbar({ name, role, club, isAdmin }: { name: string; role: string; club: string; isAdmin: boolean }) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const links = isAdmin ? [...navItems, ...clubNavItems] : clubNavItems.filter(item => item.href !== "/admin/clubs");
  const results = links.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
    <div className="relative min-w-40 flex-1 max-w-md" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <label className="flex items-center gap-3 rounded-full bg-muted px-4 py-3 text-muted-foreground">
        <SearchIcon className="size-4 shrink-0" />
        <input aria-label="Хуудас хайх" placeholder="Хуудас хайх…" value={search} onChange={event => setSearch(event.target.value)} onFocus={() => setFocused(true)} onKeyDown={event => { if (event.key === "Escape") { setFocused(false); event.currentTarget.blur(); } }} className="min-w-0 w-full bg-transparent text-sm text-foreground outline-none" />
      </label>
      {focused && <nav aria-label="Хайлтын үр дүн" className="absolute top-full mt-2 max-h-80 w-full overflow-auto rounded-xl border bg-popover p-2 shadow-lg">
        {results.map(item => <Link key={item.href} href={item.href} onClick={() => { setFocused(false); setSearch(""); }} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted focus:bg-muted"><item.icon className="size-4 text-emerald-600" />{item.label}</Link>)}
        {!results.length && <p className="p-3 text-sm text-muted-foreground">Тохирох хуудас олдсонгүй.</p>}
      </nav>}
    </div>
    <div className="ml-auto flex items-center gap-3">
      <button type="button" aria-label="Гэрэлтэй / бараан горим солих" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="rounded-full bg-muted p-3 text-muted-foreground hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-emerald-600"><MoonIcon className="size-5 dark:hidden" /><SunIcon className="hidden size-5 dark:block" /></button>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3 rounded-lg border-l pl-3 text-left outline-offset-4">
          <span className="hidden text-right sm:block"><span className="block max-w-60 truncate text-sm font-semibold">{name}</span><span className="block text-xs text-muted-foreground">{role}</span></span>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-semibold text-white" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>
          <span className="sr-only">{name}, {role} — хэрэглэгчийн цэс</span><ChevronDownIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <div className="border-b px-3 py-3"><p className="font-semibold">{name}</p><p className="text-sm text-muted-foreground">{role}</p><p className="mt-2 text-xs text-muted-foreground">{club}</p></div>
          <DropdownMenuItem onClick={() => { void logout(); }}><LogOutIcon />Системээс гарах</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>;
}
