export default function Loading() {
  return <div role="status" className="space-y-6"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><p className="text-sm text-muted-foreground">Бэлтгэл, ирцийн тайлан ачаалж байна...</p><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div><div className="h-72 animate-pulse rounded-2xl bg-muted" /></div>;
}
