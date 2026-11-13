import { useEffect, useMemo, useState } from 'react'
import { analyzeSpending, diagnose } from '@/domain/services/spending'
import { BarChart } from '@/ui/charts/BarChart'
import { AmountInput, Button, Card, CardTitle, EmptyState, Field, Notice, PeriodFields, SelectInput, Stat } from '@/ui/components/ui'
import { useNavigation, useRun, useService, useWallet } from '@/ui/context'
import { formatAr, formatDayShort, formatNumber, parseAmount } from '@/ui/format'
import { tryPeriod, wholePeriod } from '@/ui/periods'

/** Statistiques des dépenses journalières d'une catégorie → budget par jour proposé (moyenne, +½ écart-type, +1 écart-type). */
export function AnalysisSection() {
  const wallet = useWallet()
  const service = useService()
  const run = useRun()
  const { setBudgetsSection } = useNavigation()

  const names = wallet.categories.map((c) => c.name)
  const [category, setCategory] = useState('')
  const selected = names.includes(category) ? category : names[0] ?? ''
  const initial = useMemo(() => wholePeriod(wallet, service.today()), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [budgetText, setBudgetText] = useState('')
  const [budgetError, setBudgetError] = useState<string | null>(null)

  const { period, error } = useMemo(() => tryPeriod(start, end), [start, end])
  const analysis = useMemo(() => (period && selected ? analyzeSpending(wallet, selected, period) : null), [wallet, selected, period])
  const stats = analysis?.stats

  // Nouvelle analyse : on propose la moyenne comme budget retenu.
  useEffect(() => {
    setBudgetText(stats && stats.total > 0 ? formatNumber(stats.suggestions.tight) : '')
    setBudgetError(null)
  }, [selected, start, end]) // eslint-disable-line react-hooks/exhaustive-deps

  const retained = parseAmount(budgetText)
  const current = wallet.categories.find((c) => c.name === selected)?.dailyBudget ?? 0

  const save = (): void => {
    if (retained === null) {
      setBudgetError('Entrez un montant entier supérieur à 0.')
      return
    }
    setBudgetError(null)
    run(() => service.setDailyBudget(selected, retained), `Budget / jour de « ${selected} » : ${formatAr(retained)}`)
  }

  if (names.length === 0) {
    return (
      <Card>
        <EmptyState title="Ajoutez d'abord des catégories" action={<Button onClick={() => setBudgetsSection('categories')}>Aller aux catégories</Button>}>
          L'analyse se fait catégorie par catégorie, à partir de vos dépenses passées.
        </EmptyState>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Dépenses à analyser</CardTitle>
        <div className="space-y-4">
          <Field label="Catégorie">{(id) => <SelectInput id={id} value={selected} onChange={(e) => setCategory(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</SelectInput>}</Field>
          <PeriodFields start={start} end={end} onStart={setStart} onEnd={setEnd} error={error} />
        </div>
      </Card>

      {analysis && stats && (
        <>
          <Card aria-label="Résultats de l'analyse">
            <CardTitle>Résultats</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Moyenne par jour" value={formatAr(stats.mean)} tone="positive" />
              <Stat label="Médiane par jour" value={formatAr(stats.median)} />
              <Stat label="Écart-type" value={formatAr(stats.std)} />
              <Stat label="Total des dépenses" value={formatAr(stats.total)} />
              <Stat label="Jours avec dépense" value={`${stats.daysWithExpense} / ${stats.days}`} />
              <Stat label="Maximum / jour" value={formatAr(stats.maximum)} />
              <Stat label="Variabilité" value={`${Math.round(stats.variability * 100)} %`} />
              <Stat label="Jours > moyenne" value={stats.daysAboveMean} />
            </div>
            <div className="mt-4"><Notice tone="info">{diagnose(stats)}</Notice></div>
          </Card>

          <Card aria-label="Budget par jour proposé">
            <CardTitle>Budget par jour proposé</CardTitle>
            <div className="grid grid-cols-3 gap-2">
              {([['Serré', 'moyenne', stats.suggestions.tight], ['Équilibré', '+ ½ écart-type', stats.suggestions.balanced], ['Confortable', '+ 1 écart-type', stats.suggestions.comfortable]] as const).map(([title, hint, amount]) => (
                <button key={title} type="button" onClick={() => setBudgetText(formatNumber(amount))} aria-label={`${title} : ${formatAr(amount)}`}
                  className="rounded-xl border border-line px-2 py-3 text-center active:bg-brand-50">
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-[11px] text-muted">{hint}</span>
                  <span className="mt-1 block text-sm font-bold tabular-nums text-brand-700">{formatAr(amount)}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Budget par jour retenu (Ar)" error={budgetError} hint={current > 0 ? `Budget actuel de « ${selected} » : ${formatAr(current)} / jour` : `Aucun budget par jour défini pour « ${selected} ».`}>
                {(id) => <AmountInput id={id} value={budgetText} onChange={setBudgetText} placeholder="0" className="text-lg font-bold" />}
              </Field>
              <Button full onClick={save}>Enregistrer comme budget / jour</Button>
            </div>
          </Card>

          <Card aria-label="Graphique des dépenses journalières">
            <CardTitle>Dépenses de chaque jour</CardTitle>
            <BarChart bars={analysis.daily.map((d) => ({ label: formatDayShort(d.date), value: d.amount }))} mean={stats.mean} budget={retained} />
            <p className="mt-2 text-xs text-muted">Ligne bleue : moyenne. Ligne rouge pointillée : budget retenu (les jours au-dessus passent en orange).</p>
          </Card>
        </>
      )}
    </div>
  )
}
