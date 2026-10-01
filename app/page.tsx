import { redirect } from "next/navigation";
import { getEventEditor } from "@/lib/club-event-access";
import { getPackageRecipient } from "@/lib/package-recipient-access";

export default async function Home() {
  const editor = await getEventEditor();
  if (editor?.role === "superadmin") redirect("/admin");
  if (editor) redirect("/admin/club-events");
  const member = await getPackageRecipient();
  if (member?.role === "player") redirect("/player");
  redirect("/admin/login");
}
