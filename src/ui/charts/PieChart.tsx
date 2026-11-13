import { formatAr, formatPercent } from '@/ui/format'

export const PIE_COLORS = ['#217346', '#7f9c8a', '#94a7b5', '#bad6c6', '#16553a', '#4f8a6b', '#c9d6cf', '#5b7083', '#a3c9b1', '#2e5e4e']

export interface PieSlice {
  label: string
  value: number
  share: number
}

function point(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
}

/** Camembert + légende (nom, montant · pourcentage). Part de départ en haut, sens des aiguilles d'une montre. */
export function PieChart({ slices }: { slices: readonly PieSlice[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const [cx, cy, r] = [100, 100, 94]
  let angle = -Math.PI / 2
  const paths = slices.map((slice, i) => {
    const sweep = (slice.value / total) * 2 * Math.PI
    const [x1, y1] = point(cx, cy, r, angle)
    const [x2, y2] = point(cx, cy, r, angle + sweep)
    const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
    angle += sweep
    return <path key={slice.label} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
  })
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 200 200" role="img" aria-label={`Répartition des budgets restants : ${slices.map((s) => `${s.label} ${formatPercent(s.share)}`).join(', ')}`} className="size-44 shrink-0">
        {slices.length === 1 ? <circle cx={cx} cy={cy} r={r} fill={PIE_COLORS[0]} stroke="#fff" strokeWidth={2} /> : paths}
      </svg>
      <ul className="w-full space-y-2.5" aria-label="Légende">
        {slices.map((slice, i) => (
          <li key={slice.label} className="flex items-start gap-3">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-[3px]" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{slice.label}</span>
              <span className="block text-xs text-muted">{formatAr(slice.value)} · {formatPercent(slice.share)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
