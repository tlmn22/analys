import { SidebarNav } from "@/components/admin/sidebar-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/20 p-4">
        <div className="mb-6 px-2 text-lg font-semibold">
          🏀 Basketball Analytics
        </div>
        <SidebarNav />
        <Separator className="my-3" />
        <LogoutButton />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
