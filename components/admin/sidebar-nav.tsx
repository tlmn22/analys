"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  ShieldIcon,
  UsersIcon,
  CalendarIcon,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Хянах самбар", icon: LayoutDashboardIcon },
  { href: "/admin/teams", label: "Багууд", icon: ShieldIcon },
  { href: "/admin/players", label: "Тоглогчид", icon: UsersIcon },
  { href: "/admin/seasons", label: "Улирлууд", icon: CalendarIcon },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
