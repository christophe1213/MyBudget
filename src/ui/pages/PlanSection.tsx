import { useMemo, useState } from 'react'
import { categoriesWithDeposit } from '@/domain/ledger'
import { depositLabel, proposeBudget } from '@/domain/services/budget'
import { AmountInput, Button, Card, CardTitle, EmptyState, Notice, PeriodFields } from '@/ui/components/ui'
import { useNavigation, useRun, useService, useWallet } from '@/ui/context'
import { useConfirm, useToast } from '@/ui/feedback'
import { formatAr, formatDate, formatNumber, parseAmountOrZero } from '@/ui/format'
import { tryPeriod, upcomingPeriod } from '@/ui/periods'
import { CategorySheet } from './CategoriesSection'

/** Suggestion = budget par jour × nombre de jours − solde de la catégorie avant le début. Le montant retenu est libre. */
export function PlanSection() {
  const wallet = useWallet()
  const service = useService()
  const run = useRun()
  const confirm = useConfirm()
  const toast = useToast()
  const { setBudgetsSection } = useNavigation()

  const initial = useMemo(() => upcomingPeriod(wallet, service.today(), 7), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [overrides, setOverrides] = useState<Record<string, string>>({})   // montants ajustés à la main
  const [editing, setEditing] = useState<string | null>(null)

  const { period, error } = useMemo(() => tryPeriod(start, end), [start, end])
  const lines = useMemo(() => (period ? proposeBudget(wallet, period) : []), [wallet, period])
  const retained = (category: string, suggestion: number): number =>
    overrides[category] === undefined ? suggestion : parseAmountOrZero(overrides[category]!) ?? 0
  const totalSuggestion = lines.reduce((s, l) => s + l.suggestion, 0)
  const totalRetained = lines.reduce((s, l) => s + retained(l.category, l.suggestion), 0)
  const hasDaily = wallet.categories.some((c) => c.dailyBudget > 0)

  const changePeriod = (apply: () => void): void => {
    apply()
    setOverrides({})   // les suggestions changent avec la période
  }

  const validate = async (): Promise<void> => {
    if (!period) return
    const pairs = lines.map((l) => [l.category, retained(l.category, l.suggestion)] as const).filter(([, amount]) => amount > 0)
    if (pairs.length === 0) {
      toast.error('Tous les montants retenus sont à 0 : aucun dépôt à créer.')
      return
    }
    const total = pairs.reduce((s, [, amount]) => s + amount, 0)
    const label = depositLabel(period)
    const first = await confirm({
      title: 'Créer les dépôts ?',
      message: `${pairs.length} dépôt(s) pour un total de ${formatAr(total)}, datés du ${formatDate(period.start)}.`,
      confirmLabel: 'Créer les dépôts',
    })
    if (!first) return
    const already = categoriesWithDeposit(wallet, pairs.map(([c]) => c), label)
    if (already.length > 0) {
      const again = await confirm({ title: 'Budget déjà validé', message: `Un dépôt « ${label} » existe déjà pour : ${already.join(', ')}. Ajouter quand même ?`, confirmLabel: 'Ajouter quand même' })
      if (!again) return
    }
    let created = 0
    if (run(() => { created = service.createDeposits(period, pairs) })) {
      toast.success(`${created} dépôt(s) créé(s) · ${formatAr(total)}`)
      setOverrides({})
    }
  }

  if (wallet.categories.length === 0) {
    return (
      <Card>
        <EmptyState title="Ajoutez d'abord des catégories" action={<Button onClick={() => setBudgetsSection('categories')}>Aller aux catégories</Button>}>
          Chaque catégorie peut avoir un budget par jour ; l'application calcule alors combien déposer.
        </EmptyState>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Période à budgétiser</CardTitle>
        <PeriodFields start={start} end={end} onStart={(v) => changePeriod(() => setStart(v))} onEnd={(v) => changePeriod(() => setEnd(v))} error={error} />
      </Card>

      {!hasDaily && <Notice tone="info">Aucun budget par jour défini : touchez « Budget / jour » sur une ligne pour en régler un.</Notice>}

      <Card aria-label="Budgets proposés">
        <CardTitle>Budgets proposés</CardTitle>
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.category} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{line.category}</p>
                <button type="button" onClick={() => setEditing(line.category)} className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 active:bg-brand-100">
                  Budget / jour : {formatAr(line.daily)}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted">
                {line.days} jour(s) → {formatAr(line.needed)} · solde disponible {formatAr(line.balance)}
              </p>
              <div className="mt-3 grid grid-cols-[1fr_1.2fr] items-end gap-3">
                <div>
                  <p className="text-xs text-muted">Suggestion</p>
                  <p className="text-[15px] font-bold tabular-nums">{formatAr(line.suggestion)}</p>
                </div>
                <label className="block text-xs text-muted">
                  Montant retenu
                  <AmountInput aria-label={`Montant retenu pour ${line.category}`} value={overrides[line.category] ?? formatNumber(line.suggestion)}
                    onChange={(v) => setOverrides((o) => ({ ...o, [line.category]: v }))} className="mt-1 font-bold" />
                </label>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-brand-50 px-3.5 py-3 text-sm">
          <span>Total suggéré <strong>{formatAr(totalSuggestion)}</strong></span>
          <span>Total retenu <strong>{formatAr(totalRetained)}</strong></span>
        </div>
        <Button full className="mt-4" onClick={validate} disabled={!period}>Valider et créer les dépôts</Button>
        <p className="mt-2 text-center text-xs text-muted">Les dépôts sont datés du premier jour de la période. Mettez 0 pour exclure une catégorie.</p>
      </Card>
      {editing && <CategorySheet key={editing} name={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
