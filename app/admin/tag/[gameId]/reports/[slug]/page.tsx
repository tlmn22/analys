import Link from "next/link";
import { notFound } from "next/navigation";
import { REPORT_CATEGORIES } from "@/lib/report-categories";

export default async function ReportPlaceholderPage({
  params,
}: {
  params: Promise<{ gameId: string; slug: string }>;
}) {
  const { gameId, slug } = await params;
  const category = REPORT_CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
      <h1 className="text-xl font-semibold">{category.label}</h1>
      <p className="text-sm text-muted-foreground">Тун удахгүй нэмэгдэнэ.</p>
      <Link
        href={`/admin/tag/${gameId}/reports`}
        className="text-sm text-blue-500 hover:underline"
      >
        ← Reports руу буцах
      </Link>
    </div>
  );
}
