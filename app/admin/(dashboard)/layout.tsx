import Image from "next/image";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { Separator } from "@/components/ui/separator";
import { getEventEditor } from "@/lib/club-event-access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const editor = await getEventEditor();
  if (!editor) redirect("/admin/login");
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/20 p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <Image
            src="/favicon.png"
            alt="HoopsLab"
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-lg font-semibold">HoopsLab</span>
        </div>
        <SidebarNav eventsOnly={editor.role !== "superadmin"} />
        <Separator className="my-3" />
        <LogoutButton />
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
