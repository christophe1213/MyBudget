import { formatNumber } from '@/ui/format'
import { labelIndices, niceScale } from './scale'

export interface Bar {
  label: string
  value: number
}

/** Dépense de chaque jour ; ligne bleue = moyenne ; ligne rouge pointillée = budget retenu (barres au-dessus en orange). */
export function BarChart({ bars, mean, budget }: { bars: readonly Bar[]; mean: number; budget: number | null }) {
  const [width, height] = [360, 220]
  const margin = { left: 44, right: 12, top: 14, bottom: 28 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const n = bars.length
  const scale = niceScale(Math.max(...bars.map((b) => b.value), mean, budget ?? 0))
  const y = (v: number) => margin.top + plotH - (v / scale.top) * plotH
  const slot = plotW / n
  const dates = labelIndices(n, 6)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" className="h-auto w-full" aria-label={`Dépenses de chacun des ${n} jours`}>
      {scale.values.map((v) => (
        <g key={v}>
          <line x1={margin.left} x2={width - margin.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#9aa9a0' : '#edf2ef'} />
          <text x={margin.left - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#6b7b72">{formatNumber(v)}</text>
        </g>
      ))}
      {bars.map((b, i) => b.value > 0 && (
        <rect key={b.label + i} x={margin.left + i * slot + slot * 0.15} width={slot * 0.7} y={y(b.value)} height={y(0) - y(b.value)} rx={1.5}
          fill={budget !== null && b.value > budget ? '#f28c28' : '#217346'} />
      ))}
      {bars.map((b, i) => dates.has(i) && (
        <text key={`l${i}`} x={margin.left + (i + 0.5) * slot} y={height - 8} textAnchor="middle" fontSize={9} fill="#6b7b72">{b.label}</text>
      ))}
      <line x1={margin.left} x2={width - margin.right} y1={y(mean)} y2={y(mean)} stroke="#2b7de9" strokeWidth={2} />
      {budget !== null && <line x1={margin.left} x2={width - margin.right} y1={y(budget)} y2={y(budget)} stroke="#d64545" strokeWidth={2} strokeDasharray="6 4" />}
    </svg>
  )
}
