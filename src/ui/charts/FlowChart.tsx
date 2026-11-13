import { formatNumber } from '@/ui/format'
import { labelIndices, niceScale } from './scale'

export interface FlowPoint {
  label: string
  deposits: number
  expenses: number
}

const DEPOSITS = '#217346'
const EXPENSES = '#546e7a'
const MAX_VALUE_LABELS = 10
const MAX_DATE_LABELS = 6

/** Courbes des entrées et des sorties par jour, avec valeurs sur les points (si peu de jours) et dates espacées. */
export function FlowChart({ points }: { points: readonly FlowPoint[] }) {
  const [width, height] = [360, 230]
  const margin = { left: 44, right: 16, top: 16, bottom: 28 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom
  const n = points.length
  const scale = niceScale(Math.max(...points.map((p) => Math.max(p.deposits, p.expenses)), 0))
  const x = (i: number) => (n === 1 ? margin.left + plotW / 2 : margin.left + (i * plotW) / (n - 1))
  const y = (v: number) => margin.top + plotH - (v / scale.top) * plotH
  const line = (pick: (p: FlowPoint) => number) => points.map((p, i) => `${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')
  const dates = labelIndices(n, MAX_DATE_LABELS)
  const showValues = n <= MAX_VALUE_LABELS

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" className="h-auto w-full" aria-label={`Entrées et sorties sur ${n} jour(s)`}>
      {scale.values.map((v) => (
        <g key={v}>
          <line x1={margin.left} x2={width - margin.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#9aa9a0' : '#edf2ef'} />
          <text x={margin.left - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#6b7b72">{formatNumber(v)}</text>
        </g>
      ))}
      {points.map((p, i) => dates.has(i) && (
        <text key={p.label + i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={9} fill="#6b7b72">{p.label}</text>
      ))}
      {n > 1 && (
        <>
          <polyline points={line((p) => p.deposits)} fill="none" stroke={DEPOSITS} strokeWidth={2} strokeLinejoin="round" />
          <polyline points={line((p) => p.expenses)} fill="none" stroke={EXPENSES} strokeWidth={2} strokeLinejoin="round" />
        </>
      )}
      {points.map((p, i) => (
        <g key={`dot${i}`}>
          <circle cx={x(i)} cy={y(p.deposits)} r={3} fill="#fff" stroke={DEPOSITS} strokeWidth={2} />
          <circle cx={x(i)} cy={y(p.expenses)} r={3} fill="#fff" stroke={EXPENSES} strokeWidth={2} />
          {showValues && [...new Set([p.expenses, p.deposits])].map((v) => (
            <text key={v} x={x(i)} y={y(v) - 8} textAnchor="middle" fontSize={9} fill="#1e2a24">{formatNumber(v)}</text>
          ))}
        </g>
      ))}
    </svg>
  )
}

export function FlowLegend({ depositsText, expensesText }: { depositsText: string; expensesText: string }) {
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium">
      <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded" style={{ background: DEPOSITS }} aria-hidden />{depositsText}</span>
      <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded" style={{ background: EXPENSES }} aria-hidden />{expensesText}</span>
    </p>
  )
}
