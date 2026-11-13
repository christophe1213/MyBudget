import { useMemo, useState } from 'react'
import type { Period } from '@/domain/period'
import { buildReport } from '@/domain/services/reports'
import { Card, CardTitle, Chip, EmptyState, PageTitle, PeriodFields, Stat } from '@/ui/components/ui'
import { useService, useWallet } from '@/ui/context'
import { formatAr, formatPercent, formatSigned } from '@/ui/format'
import { recentPeriod, tryPeriod, wholePeriod } from '@/ui/periods'

export function ReportPage() {
  const wallet = useWallet()
  const service = useService()
  const today = service.today()
  const initial = useMemo(() => wholePeriod(wallet, today), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const { period, error } = useMemo(() => tryPeriod(start, end), [start, end])
  const report = useMemo(() => (period ? buildReport(wallet, period) : null), [wallet, period])
  const apply = (p: Period): void => { setStart(p.start); setEnd(p.end) }

  return (
    <div className="space-y-4">
      <PageTitle title="Rapport" subtitle="Dépôts et dépenses de chaque catégorie entre deux dates" />
      <Card>
        <div className="mb-3 flex gap-2" role="group" aria-label="Raccourcis de période">
          <Chip onClick={() => apply(recentPeriod(wallet, today, 7))}>7 j</Chip>
          <Chip onClick={() => apply(recentPeriod(wallet, today, 30))}>30 j</Chip>
          <Chip onClick={() => apply(wholePeriod(wallet, today))}>Tout</Chip>
        </div>
        <PeriodFields start={start} end={end} onStart={setStart} onEnd={setEnd} error={error} />
      </Card>

      {report && (
        <>
          <Card aria-label="Résumé de la période">
            <CardTitle>Résumé</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Solde au début" value={formatAr(report.openingBalance)} />
              <Stat label="Solde à la fin" value={formatAr(report.closingBalance)} />
              <Stat label="Total des dépôts" value={formatAr(report.totalDeposits)} tone="positive" />
              <Stat label="Total des dépenses" value={formatAr(report.totalExpenses)} tone={report.totalExpenses > 0 ? 'negative' : 'default'} />
              <Stat label="Net" value={formatSigned(report.net)} tone={report.net < 0 ? 'negative' : 'positive'} />
              <Stat label="Dépense moyenne / jour" value={formatAr(report.averageDailyExpense)} />
            </div>
          </Card>

          <Card aria-label="Totaux par catégorie">
            <CardTitle>Par catégorie</CardTitle>
            {report.categories.length === 0 ? (
              <EmptyState title="Aucune transaction sur cette période" />
            ) : (
              <ul className="space-y-4">
                {report.categories.map((c) => (
                  <li key={c.category}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-semibold">{c.category}</p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-danger">{formatAr(c.expenses)}</p>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50" role="img" aria-label={`${formatPercent(c.expenseShare)} des dépenses`}>
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${c.expenseShare}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatPercent(c.expenseShare)} des dépenses · dépôts {formatAr(c.deposits)} · net {formatSigned(c.net)} · {c.count} transaction(s)
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {report.topExpenses.length > 0 && (
            <Card aria-label="Plus grosses dépenses">
              <CardTitle>Plus grosses dépenses</CardTitle>
              <ol className="divide-y divide-line">
                {report.topExpenses.map((e, i) => (
                  <li key={`${e.category}-${e.label}`} className="flex items-center gap-3 py-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{e.label || e.category}</span>
                      <span className="block truncate text-xs text-muted">{e.category}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatAr(e.amount)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
