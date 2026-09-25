"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  ShieldIcon,
  UsersIcon,
  CalendarIcon,
  Building2Icon,
  IdCardIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Хянах самбар", icon: LayoutDashboardIcon },
  { href: "/admin/teams", label: "Багууд", icon: ShieldIcon },
  { href: "/admin/players", label: "Тоглогчид", icon: UsersIcon },
  { href: "/admin/seasons", label: "Улирлууд", icon: CalendarIcon },
];

const clubNavItems = [
  { href: "/admin/clubs", label: "Клубууд", icon: Building2Icon },
  { href: "/admin/club-staff", label: "Клубын ажилтнууд", icon: IdCardIcon },
  { href: "/admin/club-events", label: "Клубын эвентүүд", icon: CalendarCheckIcon },
  { href: "/admin/club-reports", label: "Бэлтгэл, ирцийн тайлан", icon: ChartNoAxesCombinedIcon },
  { href: "/admin/club-load-monitoring", label: "Ачааллын Monitoring", icon: ChartNoAxesCombinedIcon },
];

export function SidebarNav({ eventsOnly = false }: { eventsOnly?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {(eventsOnly ? [clubNavItems.filter((item) => ["/admin/club-staff", "/admin/club-events", "/admin/club-reports", "/admin/club-load-monitoring"].includes(item.href))] : [navItems, clubNavItems]).map((items, groupIndex) => (
        <div
          key={groupIndex}
          className={cn(
            "flex flex-col gap-1",
            groupIndex === 1 && "mt-6 border-t border-border pt-4"
          )}
        >
          {items.map((item) => {
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
        </div>
      ))}
    </nav>
  );
}
