import { useState } from 'react'
import { addDays } from '@/domain/dates'
import { transactionsOn } from '@/domain/ledger'
import type { Kind } from '@/domain/model'
import { balanceAt } from '@/domain/services/balances'
import { TrashIcon } from '@/ui/components/icons'
import { AmountInput, Button, Card, DateInput, EmptyState, Field, PageTitle, Segmented, SelectInput, TextInput } from '@/ui/components/ui'
import { useNavigation, useRun, useService, useWallet } from '@/ui/context'
import { useConfirm, useToast } from '@/ui/feedback'
import { formatAr, formatDayFull, parseAmount } from '@/ui/format'

const KINDS = [{ value: 'expense', label: 'Dépense' }, { value: 'deposit', label: 'Dépôt' }] as const

export function EntryPage() {
  const wallet = useWallet()
  const service = useService()
  const run = useRun()
  const confirm = useConfirm()
  const toast = useToast()
  const { go } = useNavigation()

  const [kind, setKind] = useState<Kind>('expense')
  const [date, setDate] = useState(service.today())
  const [category, setCategory] = useState('')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)

  const names = wallet.categories.map((c) => c.name)
  const selected = names.includes(category) ? category : names[0] ?? ''
  const day = date || service.today()
  const items = transactionsOn(wallet, day)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value === null) {
      setAmountError('Entrez un montant entier supérieur à 0.')
      return
    }
    setAmountError(null)
    const ok = run(() => service.addTransaction({ date: day, category: selected, kind, label, amount: value }), kind === 'expense' ? 'Dépense ajoutée' : 'Dépôt ajouté')
    if (ok) {
      setAmount('')
      setLabel('')
    }
  }

  const remove = async (id: string, text: string): Promise<void> => {
    if (await confirm({ title: 'Supprimer cette transaction ?', message: text, confirmLabel: 'Supprimer', danger: true })) {
      if (run(() => service.deleteTransactions([id]))) toast.success('Transaction supprimée')
    }
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Saisie" subtitle="Enregistrez vos dépôts et vos dépenses" />
      {names.length === 0 ? (
        <Card>
          <EmptyState title="Créez d'abord une catégorie" action={<Button onClick={() => go('budgets', 'categories')}>Ajouter une catégorie</Button>}>
            Les catégories (riz, bazar, transport…) servent aussi de budgets.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-4" aria-label="Nouvelle transaction">
            <Segmented label="Type de transaction" value={kind} onChange={setKind} options={KINDS} />
            <Field label="Montant (Ar)" error={amountError}>
              {(id) => <AmountInput id={id} value={amount} onChange={setAmount} placeholder="0" className="text-xl font-bold" />}
            </Field>
            <Field label="Catégorie">
              {(id) => <SelectInput id={id} value={selected} onChange={(e) => setCategory(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</SelectInput>}
            </Field>
            <Field label="Libellé (facultatif)">
              {(id) => <TextInput id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'expense' ? 'ex. tomates' : 'ex. salaire'} autoComplete="off" />}
            </Field>
            <Field label="Date">{(id) => <DateInput id={id} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Button type="submit" full>{kind === 'expense' ? 'Ajouter la dépense' : 'Ajouter le dépôt'}</Button>
          </form>
        </Card>
      )}

      <Card aria-label="Transactions du jour">
        <div className="mb-1 flex items-center justify-between gap-2">
          <Button variant="ghost" small aria-label="Jour précédent" onClick={() => setDate(addDays(day, -1))}>‹</Button>
          <h2 className="text-center text-sm font-bold capitalize">{formatDayFull(day)}</h2>
          <Button variant="ghost" small aria-label="Jour suivant" onClick={() => setDate(addDays(day, 1))}>›</Button>
        </div>
        <p className="mb-2 text-center text-xs text-muted">Solde à cette date : <strong className="text-ink">{formatAr(balanceAt(wallet, day))}</strong></p>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Aucune transaction ce jour-là.</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.label || t.category}</p>
                  <p className="truncate text-xs text-muted">{t.label ? t.category : t.kind === 'deposit' ? 'Dépôt' : 'Dépense'}</p>
                </div>
                <p className={`shrink-0 font-bold tabular-nums ${t.kind === 'deposit' ? 'text-brand-700' : 'text-danger'}`}>
                  {t.kind === 'deposit' ? '+' : '\u2212'}{formatAr(t.amount)}
                </p>
                <button type="button" aria-label={`Supprimer ${t.label || t.category}`} onClick={() => remove(t.id, `${t.label || t.category} · ${formatAr(t.amount)}`)}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-muted active:bg-danger-50 active:text-danger"><TrashIcon className="size-5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
