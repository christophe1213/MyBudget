import { useMemo, useRef, useState } from 'react'
import type { Wallet } from '@/domain/model'
import type { Period } from '@/domain/period'
import { startingBalance, totalBalance } from '@/domain/services/balances'
import { budgetShares, flows } from '@/domain/services/dashboard'
import { FlowChart, FlowLegend } from '@/ui/charts/FlowChart'
import { PieChart } from '@/ui/charts/PieChart'
import { Button, Card, CardTitle, Chip, EmptyState, PageTitle, PeriodFields } from '@/ui/components/ui'
import { useNavigation, useService, useWallet } from '@/ui/context'
import { formatAr, formatDayShort } from '@/ui/format'
import { recentPeriod, tryPeriod, wholePeriod } from '@/ui/periods'
import { flowsNote, sharesNote } from './dashboardNotes'

export function DashboardPage() {
  const wallet = useWallet()
  return (
    <div className="space-y-4">
      <PageTitle title="Tableau de bord" subtitle="Où en sont vos budgets et comment l'argent circule" />
      <BalanceCard wallet={wallet} />
      <SharesCard wallet={wallet} />
      <FlowsCard key={wallet.id} wallet={wallet} />
    </div>
  )
}

function BalanceCard({ wallet }: { wallet: Wallet }) {
  const total = totalBalance(wallet)
  return (
    <section className="rounded-2xl bg-brand-600 p-5 text-white shadow-sm" aria-label="Solde total">
      <p className="text-sm text-brand-100">{wallet.name} · solde total</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${total < 0 ? 'text-warn-50' : ''}`}>{formatAr(total)}</p>
      <p className="mt-2 text-xs text-brand-100">Solde initial {formatAr(startingBalance(wallet))} · {wallet.transactions.length} transaction(s)</p>
    </section>
  )
}

function SharesCard({ wallet }: { wallet: Wallet }) {
  const { go } = useNavigation()
  const shares = useMemo(() => budgetShares(wallet), [wallet])
  return (
    <Card aria-label="Répartition des budgets restants">
      <CardTitle>Répartition des budgets restants</CardTitle>
      {shares.items.length === 0 ? (
        <EmptyState title="Aucun solde positif pour le moment"
          action={<Button variant="secondary" onClick={() => go('entry')}>Ajouter un dépôt</Button>}>
          Le camembert montre le solde restant de chaque budget (dépôts − dépenses) dès qu'il est positif.
        </EmptyState>
      ) : (
        <>
          <PieChart slices={shares.items.map((i) => ({ label: i.category, value: i.balance, share: i.share }))} />
          <p className="mt-4 text-xs text-muted">{sharesNote(shares)}</p>
        </>
      )}
    </Card>
  )
}

function FlowsCard({ wallet }: { wallet: Wallet }) {
  const service = useService()
  const today = service.today()
  const initial = useMemo(() => recentPeriod(wallet, today, 14), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const lastValid = useRef<Period>(initial)

  const parsed = useMemo(() => tryPeriod(start, end), [start, end])
  if (parsed.period) lastValid.current = parsed.period   // une saisie incomplète ne vide pas le graphique
  const series = useMemo(() => flows(wallet, lastValid.current), [wallet, parsed.period])

  const apply = (p: Period): void => { setStart(p.start); setEnd(p.end) }
  return (
    <Card aria-label="Entrées et sorties selon les dates">
      <CardTitle>Entrées et sorties selon les dates</CardTitle>
      <div className="mb-3 flex gap-2" role="group" aria-label="Raccourcis de période">
        <Chip onClick={() => apply(recentPeriod(wallet, today, 7))}>7 j</Chip>
        <Chip onClick={() => apply(recentPeriod(wallet, today, 30))}>30 j</Chip>
        <Chip onClick={() => apply(wholePeriod(wallet, today))}>Tout</Chip>
      </div>
      <PeriodFields start={start} end={end} onStart={setStart} onEnd={setEnd} error={parsed.error} />
      <div className="mt-4 space-y-3">
        <FlowLegend depositsText={`Entrées · ${formatAr(series.totalDeposits)}`} expensesText={`Sorties · ${formatAr(series.totalExpenses)}`} />
        <FlowChart points={series.days.map((d) => ({ label: formatDayShort(d.date), deposits: d.deposits, expenses: d.expenses }))} />
        <p className="text-xs text-muted">{flowsNote(series)}</p>
      </div>
    </Card>
  )
}
