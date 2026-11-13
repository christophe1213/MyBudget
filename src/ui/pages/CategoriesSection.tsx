import { useMemo, useState } from 'react'
import { categoryUsage, dailyBudget } from '@/domain/ledger'
import { categoryBalances } from '@/domain/services/balances'
import { Sheet } from '@/ui/components/Sheet'
import { AmountInput, Button, Card, CardTitle, EmptyState, Field, TextInput } from '@/ui/components/ui'
import { useRun, useService, useWallet } from '@/ui/context'
import { useConfirm } from '@/ui/feedback'
import { formatAr, formatNumber, formatSigned, parseAmountOrZero } from '@/ui/format'

export function CategoriesSection() {
  const wallet = useWallet()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const balances = useMemo(() => categoryBalances(wallet), [wallet])

  return (
    <>
      <Card aria-label="Catégories">
        <CardTitle aside={<Button small onClick={() => setAdding(true)}>+ Nouvelle</Button>}>Catégories</CardTitle>
        {wallet.categories.length === 0 ? (
          <EmptyState title="Aucune catégorie">Une catégorie est aussi un budget : ajoutez par exemple « riz », « bazar » ou « transport ».</EmptyState>
        ) : (
          <ul className="-mx-1 divide-y divide-line">
            {wallet.categories.map((c) => {
              const balance = balances.get(c.name) ?? 0
              return (
                <li key={c.name}>
                  <button type="button" onClick={() => setEditing(c.name)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-surface">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="block text-xs text-muted">{c.dailyBudget > 0 ? `Budget : ${formatAr(c.dailyBudget)} / jour` : 'Pas de budget par jour'}{c.initialBalance > 0 ? ` · départ ${formatAr(c.initialBalance)}` : ''}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${balance < 0 ? 'text-danger' : 'text-brand-700'}`}>{formatSigned(balance)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Solde = solde de départ + dépôts − dépenses de la catégorie. Touchez une catégorie pour la renommer, régler son budget par jour, son solde de départ ou la supprimer.</p>
      </Card>
      {adding && <NewCategorySheet onClose={() => setAdding(false)} />}
      {editing && <CategorySheet key={editing} name={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function NewCategorySheet({ onClose }: { onClose: () => void }) {
  const service = useService()
  const run = useRun()
  const [name, setName] = useState('')
  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (run(() => service.addCategory(name), 'Catégorie ajoutée')) onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Nouvelle catégorie" footer={<Button type="submit" form="new-category" full>Ajouter</Button>}>
      <form id="new-category" onSubmit={submit}>
        <Field label="Nom">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Transport" autoFocus autoComplete="off" />}</Field>
      </form>
    </Sheet>
  )
}

/** Renommer une catégorie, régler son budget par jour, la supprimer. Aussi utilisée depuis l'écran « Planifier ». */
export function CategorySheet({ name, onClose }: { name: string; onClose: () => void }) {
  const wallet = useWallet()
  const service = useService()
  const run = useRun()
  const confirm = useConfirm()
  const [newName, setNewName] = useState(name)
  const [budget, setBudget] = useState(dailyBudget(wallet, name) ? formatNumber(dailyBudget(wallet, name)) : '')
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const startOf = wallet.categories.find((c) => c.name === name)?.initialBalance ?? 0
  const [start, setStart] = useState(startOf ? formatNumber(startOf) : '')
  const [startError, setStartError] = useState<string | null>(null)
  const usage = categoryUsage(wallet, name)

  const save = (e: React.FormEvent): void => {
    e.preventDefault()
    const amount = parseAmountOrZero(budget)
    const startAmount = parseAmountOrZero(start)
    setBudgetError(amount === null ? 'Entrez un montant entier (0 pour supprimer le budget).' : null)
    setStartError(startAmount === null ? 'Entrez un montant entier (0 si la catégorie démarre vide).' : null)
    if (amount === null || startAmount === null) return
    const finalName = newName.trim().replace(/\s+/g, ' ')
    const ok = run(() => {
      if (finalName !== name) service.renameCategory(name, newName)
      service.setDailyBudget(finalName, amount)
      service.setCategoryInitialBalance(finalName, startAmount)
    }, 'Catégorie enregistrée')
    if (ok) onClose()
  }

  const remove = async (): Promise<void> => {
    const ok = await confirm({ title: `Supprimer « ${name} » ?`, message: startOf > 0 ? `La catégorie sera retirée de la liste, avec son solde de départ de ${formatAr(startOf)} : le solde total diminue d'autant.` : 'La catégorie sera retirée de la liste.', confirmLabel: 'Supprimer', danger: true })
    if (ok && run(() => service.removeCategory(name), 'Catégorie supprimée')) onClose()
  }

  return (
    <Sheet open onClose={onClose} title={name}
      footer={(
        <>
          <Button type="submit" form="edit-category" full>Enregistrer</Button>
          <Button variant="danger" full disabled={usage > 0} onClick={remove}>Supprimer la catégorie</Button>
          {usage > 0 && <p className="text-center text-xs text-muted">Utilisée par {usage} transaction(s) : impossible de la supprimer.</p>}
        </>
      )}>
      <form id="edit-category" onSubmit={save} className="space-y-4">
        <Field label="Nom">{(id) => <TextInput id={id} value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />}</Field>
        <Field label="Budget par jour (Ar)" hint="Sert à calculer les budgets à déposer. Laissez vide pour ne pas en avoir." error={budgetError}>
          {(id) => <AmountInput id={id} value={budget} onChange={setBudget} placeholder="0" />}
        </Field>
        <Field label="Solde de départ (Ar)" hint="Argent déjà présent dans cette catégorie avant votre première transaction. Il s'ajoute au solde total et réduit le montant à déposer." error={startError}>
          {(id) => <AmountInput id={id} value={start} onChange={setStart} placeholder="0" />}
        </Field>
      </form>
    </Sheet>
  )
}
