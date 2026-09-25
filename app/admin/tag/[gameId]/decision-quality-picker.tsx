"use client";

import type { DecisionQuality } from "@/lib/decision-quality";

export function DecisionQualityPicker({ value, onChange, disabled = false }: {
  value: DecisionQuality; onChange: (value: DecisionQuality) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
    <legend className="px-1 text-sm font-semibold">Довтолгооны шийдвэр</legend>
    {([['good', 'Good decision — Зөв шийдвэр'], ['bad', 'Bad decision — Буруу шийдвэр']] as const).map(([quality, label]) =>
      <label key={quality} className={`flex cursor-pointer items-center gap-2 text-sm ${quality === 'good' ? 'text-emerald-500' : 'text-red-400'}`}>
        <input type="checkbox" checked={value === quality} onChange={e => onChange(e.target.checked ? quality : null)} />{label}
      </label>)}
    <p className="text-xs text-muted-foreground">{disabled ? "Үнэлгээ хараахан идэвхжээгүй." : "Заавал сонгохгүй. Нэг шийдвэрийг нэг event дээр үнэлнэ."}</p>
  </fieldset>;
}
