import type { IsoDate } from '../dates'
import { signedAmount, type Wallet } from '../model'

export interface DayBalance {
  readonly date: IsoDate
  readonly deposits: number
  readonly expenses: number
  /** Solde en fin de journée (solde de départ compris). */
  readonly balance: number
}

/** Solde de départ du portefeuille : la part hors catégories (`initialBalance`) + le solde de départ de chaque catégorie. */
export const startingBalance = (w: Wallet): number => w.initialBalance + w.categories.reduce((sum, c) => sum + c.initialBalance, 0)

export function balanceByDate(w: Wallet): DayBalance[] {
  const flows = new Map<IsoDate, { deposits: number; expenses: number }>()
  for (const t of w.transactions) {
    const flow = flows.get(t.date) ?? { deposits: 0, expenses: 0 }
    if (t.kind === 'deposit') flow.deposits += t.amount
    else flow.expenses += t.amount
    flows.set(t.date, flow)
  }
  let balance = startingBalance(w)
  return [...flows.keys()].sort().map((date) => {
    const { deposits, expenses } = flows.get(date)!
    balance += deposits - expenses
    return { date, deposits, expenses, balance }
  })
}

/** Solde à la fin du jour donné (toutes les transactions jusqu'à ce jour comprises). */
export const balanceAt = (w: Wallet, day: IsoDate): number =>
  startingBalance(w) + w.transactions.filter((t) => t.date <= day).reduce((sum, t) => sum + signedAmount(t), 0)

export const totalBalance = (w: Wallet): number => startingBalance(w) + w.transactions.reduce((sum, t) => sum + signedAmount(t), 0)

/** Solde de chaque catégorie (solde de départ + dépôts − dépenses ; le solde initial du portefeuille n'est rattaché à aucune catégorie). */
export function categoryBalances(w: Wallet, before?: IsoDate): Map<string, number> {
  const balances = new Map<string, number>(w.categories.map((c) => [c.name, c.initialBalance]))
  for (const t of w.transactions) {
    if (before !== undefined && t.date >= before) continue
    balances.set(t.category, (balances.get(t.category) ?? 0) + signedAmount(t))
  }
  return balances
}
