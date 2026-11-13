import type { IsoDate } from '../dates'
import { signedAmount, type Wallet } from '../model'

export interface DayBalance {
  readonly date: IsoDate
  readonly deposits: number
  readonly expenses: number
  /** Solde en fin de journée (solde initial compris). */
  readonly balance: number
}

export function balanceByDate(w: Wallet): DayBalance[] {
  const flows = new Map<IsoDate, { deposits: number; expenses: number }>()
  for (const t of w.transactions) {
    const flow = flows.get(t.date) ?? { deposits: 0, expenses: 0 }
    if (t.kind === 'deposit') flow.deposits += t.amount
    else flow.expenses += t.amount
    flows.set(t.date, flow)
  }
  let balance = w.initialBalance
  return [...flows.keys()].sort().map((date) => {
    const { deposits, expenses } = flows.get(date)!
    balance += deposits - expenses
    return { date, deposits, expenses, balance }
  })
}

/** Solde à la fin du jour donné (toutes les transactions jusqu'à ce jour comprises). */
export const balanceAt = (w: Wallet, day: IsoDate): number =>
  w.initialBalance + w.transactions.filter((t) => t.date <= day).reduce((sum, t) => sum + signedAmount(t), 0)

export const totalBalance = (w: Wallet): number => w.initialBalance + w.transactions.reduce((sum, t) => sum + signedAmount(t), 0)

/** Solde de chaque catégorie (dépôts - dépenses ; le solde initial n'est rattaché à aucune catégorie). */
export function categoryBalances(w: Wallet, before?: IsoDate): Map<string, number> {
  const balances = new Map<string, number>(w.categories.map((c) => [c.name, 0]))
  for (const t of w.transactions) {
    if (before !== undefined && t.date >= before) continue
    balances.set(t.category, (balances.get(t.category) ?? 0) + signedAmount(t))
  }
  return balances
}
