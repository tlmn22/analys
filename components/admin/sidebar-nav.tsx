"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboardIcon,
  ShieldIcon,
  UsersIcon,
  CalendarIcon,
  FolderOpenIcon,
  Building2Icon,
  IdCardIcon,
  CalendarCheckIcon,
  ChartNoAxesCombinedIcon,
  ClipboardListIcon,
  EyeIcon,
  TvIcon,
} from "lucide-react";

export const navItems = [
  { href: "/admin", label: "Хянах самбар", icon: LayoutDashboardIcon },
  { href: "/admin/teams", label: "Багууд", icon: ShieldIcon },
  { href: "/admin/players", label: "Тоглогчид", icon: UsersIcon },
  { href: "/admin/seasons", label: "Улирлууд", icon: CalendarIcon },
  { href: "/admin/report-activity", label: "Тайлангийн үзэлт", icon: EyeIcon },
];

export const clubNavItems = [
  { href: "/admin/clubs", label: "Клубууд", icon: Building2Icon },
  { href: "/admin/club-staff", label: "Клубын ажилтнууд", icon: IdCardIcon },
  { href: "/admin/club-events", label: "Клубын эвентүүд", icon: CalendarCheckIcon },
  { href: "/admin/club-reports", label: "Бэлтгэл, ирцийн тайлан", icon: ChartNoAxesCombinedIcon },
  { href: "/admin/club-load-monitoring", label: "Ачааллын Monitoring", icon: ChartNoAxesCombinedIcon },
];

export const scoutingNavItems = [
  { href: "/admin/scouting-reports", label: "Scouting Reports", icon: ClipboardListIcon },
  { href: "/admin/event-packages", label: "Videos", icon: FolderOpenIcon },
  { href: "/admin/full-games", label: "Full Game", icon: TvIcon },
];

export function SidebarNav({ eventsOnly = false, onNavigate }: { eventsOnly?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = eventsOnly
    ? [clubNavItems.filter(item => item.href !== "/admin/clubs"), scoutingNavItems]
    : [navItems, clubNavItems, scoutingNavItems];

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {groups.map((items, groupIndex) => (
        <div
          key={groupIndex}
          className={cn(
            "flex flex-col gap-1",
            groupIndex > 0 && "mt-6 border-t border-border pt-4"
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
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-3 text-sm lg:py-2 transition-colors hover:bg-muted",
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
