/**
 * Règles métier d'un portefeuille. Toutes les fonctions sont PURES : elles retournent un nouveau portefeuille
 * (ou lèvent une DomainError) et ne modifient jamais leur argument. Invariants : toute transaction appartient à
 * une catégorie connue ; les noms de catégories sont uniques sans tenir compte de la casse.
 */
import { DomainError } from './errors'
import { isIsoDate, type IsoDate } from './dates'
import type { Category, Kind, Transaction, Wallet } from './model'

const byName = (a: Category, b: Category): number => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })

export const hasCategory = (w: Wallet, name: string, ignore?: string): boolean =>
  w.categories.some((c) => c.name !== ignore && c.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))

export const categoryUsage = (w: Wallet, name: string): number => w.transactions.filter((t) => t.category === name).length

export const dailyBudget = (w: Wallet, name: string): number => w.categories.find((c) => c.name === name)?.dailyBudget ?? 0

export function emptyWallet(id: string, name: string): Wallet {
  return { id, name, initialBalance: 0, categories: [], transactions: [] }
}

/** Crée un portefeuille cohérent : les catégories utilisées par des transactions sont ajoutées si elles manquent. */
export function normalizeWallet(w: Wallet): Wallet {
  const known = new Map(w.categories.map((c) => [c.name, c]))
  for (const t of w.transactions) if (t.category && !known.has(t.category)) known.set(t.category, { name: t.category, dailyBudget: 0, initialBalance: 0 })
  return { ...w, categories: [...known.values()].sort(byName) }
}

export function addCategory(w: Wallet, rawName: string): Wallet {
  const name = rawName.trim().replace(/\s+/g, ' ')
  if (!name) throw new DomainError('Le nom ne peut pas être vide.')
  if (hasCategory(w, name)) throw new DomainError(`La catégorie « ${name} » existe déjà.`)
  return { ...w, categories: [...w.categories, { name, dailyBudget: 0, initialBalance: 0 }].sort(byName) }
}

export function renameCategory(w: Wallet, oldName: string, rawNew: string): Wallet {
  const next = rawNew.trim().replace(/\s+/g, ' ')
  if (!w.categories.some((c) => c.name === oldName)) throw new DomainError('Catégorie inconnue.')
  if (!next) throw new DomainError('Le nom ne peut pas être vide.')
  if (hasCategory(w, next, oldName)) throw new DomainError(`La catégorie « ${next} » existe déjà.`)
  return {
    ...w,
    categories: w.categories.map((c) => (c.name === oldName ? { ...c, name: next } : c)).sort(byName),
    transactions: w.transactions.map((t) => (t.category === oldName ? { ...t, category: next } : t)),
  }
}

export function removeCategory(w: Wallet, name: string): Wallet {
  const usage = categoryUsage(w, name)
  if (usage > 0) {
    throw new DomainError(
      `La catégorie « ${name} » est utilisée par ${usage} transaction(s). Renommez-la, ou supprimez d'abord ces transactions.`,
    )
  }
  return { ...w, categories: w.categories.filter((c) => c.name !== name) }
}

/** Budget par jour d'une catégorie ; 0 le supprime. */
export function setDailyBudget(w: Wallet, name: string, amount: number): Wallet {
  if (!w.categories.some((c) => c.name === name)) throw new DomainError('Catégorie inconnue.')
  if (!Number.isInteger(amount) || amount < 0) throw new DomainError('Le budget doit être un entier positif ou nul.')
  return { ...w, categories: w.categories.map((c) => (c.name === name ? { ...c, dailyBudget: amount } : c)) }
}

/** Solde de départ d'une catégorie (argent déjà présent avant la première transaction). */
export function setCategoryInitialBalance(w: Wallet, name: string, amount: number): Wallet {
  if (!w.categories.some((c) => c.name === name)) throw new DomainError('Catégorie inconnue.')
  if (!Number.isInteger(amount)) throw new DomainError('Le solde de départ doit être un nombre entier.')
  return { ...w, categories: w.categories.map((c) => (c.name === name ? { ...c, initialBalance: amount } : c)) }
}

export interface NewTransaction {
  readonly date: IsoDate
  readonly category: string
  readonly kind: Kind
  readonly label: string
  readonly amount: number
}

export function addTransaction(w: Wallet, input: NewTransaction, id: string): Wallet {
  if (!isIsoDate(input.date)) throw new DomainError('Date invalide.')
  if (!w.categories.some((c) => c.name === input.category)) throw new DomainError('Choisissez une catégorie dans la liste.')
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new DomainError('Montant invalide (entier positif attendu).')
  const label = input.label.trim() || (input.kind === 'deposit' ? 'dépôt' : '')
  const created: Transaction = { id, date: input.date, category: input.category, kind: input.kind, label, amount: input.amount }
  return { ...w, transactions: [...w.transactions, created] }
}

export function removeTransactions(w: Wallet, ids: readonly string[]): Wallet {
  const gone = new Set(ids)
  return { ...w, transactions: w.transactions.filter((t) => !gone.has(t.id)) }
}

/** Un dépôt par (catégorie, montant > 0). */
export function addDeposits(
  w: Wallet, lines: readonly (readonly [string, number])[], date: IsoDate, label: string, newId: () => string,
): Wallet {
  const known = new Set(w.categories.map((c) => c.name))
  const created = lines
    .filter(([category, amount]) => amount > 0 && known.has(category))
    .map(([category, amount]): Transaction => ({ id: newId(), date, category, kind: 'deposit', label, amount }))
  return { ...w, transactions: [...w.transactions, ...created] }
}

/** Parmi `categories`, celles qui ont déjà un dépôt portant ce libellé. */
export function categoriesWithDeposit(w: Wallet, categories: readonly string[], label: string): string[] {
  const wanted = new Set(categories)
  return [...new Set(w.transactions.filter((t) => t.kind === 'deposit' && t.label === label && wanted.has(t.category)).map((t) => t.category))].sort()
}

export function setInitialBalance(w: Wallet, amount: number): Wallet {
  if (!Number.isInteger(amount)) throw new DomainError('Entrez un nombre entier.')
  return { ...w, initialBalance: amount }
}

export const transactionsOn = (w: Wallet, date: IsoDate): Transaction[] => w.transactions.filter((t) => t.date === date)

export function dateRange(w: Wallet): { start: IsoDate; end: IsoDate } | null {
  if (w.transactions.length === 0) return null
  const dates = w.transactions.map((t) => t.date)
  return { start: dates.reduce((a, b) => (a < b ? a : b)), end: dates.reduce((a, b) => (a > b ? a : b)) }
}
