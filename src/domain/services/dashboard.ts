/** Indicateurs du tableau de bord : soldes restants par budget et flux d'argent par jour. */
import { eachDay, type IsoDate } from '../dates'
import type { Wallet } from '../model'
import { periodContains, type Period } from '../period'
import { categoryBalances } from './balances'

export interface BudgetShare {
  readonly category: string
  readonly balance: number
  /** Part du total des soldes positifs, en %, arrondie à une décimale. */
  readonly share: number
}

export interface BudgetShares {
  /** Soldes positifs, du plus grand au plus petit. */
  readonly items: readonly BudgetShare[]
  readonly total: number
  /** Catégories dont les dépenses dépassent les dépôts (montant > 0) : elles ne peuvent pas figurer dans un camembert. */
  readonly deficits: readonly { category: string; amount: number }[]
  readonly deficitTotal: number
}

export function budgetShares(w: Wallet): BudgetShares {
  const balances = [...categoryBalances(w)]
  const positive = balances.filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
  const total = positive.reduce((sum, [, b]) => sum + b, 0)
  const deficits = balances
    .filter(([, b]) => b < 0)
    .map(([category, b]) => ({ category, amount: -b }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'fr'))
  return {
    items: positive.map(([category, balance]) => ({ category, balance, share: Math.round((balance / total) * 1000) / 10 })),
    total,
    deficits,
    deficitTotal: deficits.reduce((sum, d) => sum + d.amount, 0),
  }
}

export interface DayFlow {
  readonly date: IsoDate
  readonly deposits: number
  readonly expenses: number
}

export interface FlowSeries {
  readonly period: Period
  /** Un élément pour CHAQUE jour de la période (zéros compris). */
  readonly days: readonly DayFlow[]
  readonly totalDeposits: number
  readonly totalExpenses: number
  readonly peakExpenseDay: DayFlow | null
  /** Ce jour-là : (catégorie, dépense), du plus grand au plus petit. */
  readonly peakExpenseBreakdown: readonly { category: string; amount: number }[]
  readonly peakDepositDay: DayFlow | null
}

export function flows(w: Wallet, period: Period): FlowSeries {
  const deposits = new Map<IsoDate, number>(eachDay(period.start, period.end).map((d) => [d, 0]))
  const expenses = new Map(deposits)
  const byCategory = new Map<IsoDate, Map<string, number>>()
  for (const t of w.transactions) {
    if (!periodContains(period, t.date)) continue
    if (t.kind === 'deposit') deposits.set(t.date, deposits.get(t.date)! + t.amount)
    else {
      expenses.set(t.date, expenses.get(t.date)! + t.amount)
      const day = byCategory.get(t.date) ?? new Map<string, number>()
      day.set(t.category, (day.get(t.category) ?? 0) + t.amount)
      byCategory.set(t.date, day)
    }
  }
  const days = [...deposits.keys()].map((date): DayFlow => ({ date, deposits: deposits.get(date)!, expenses: expenses.get(date)! }))
  const peak = (pick: (d: DayFlow) => number): DayFlow | null =>
    days.reduce<DayFlow | null>((best, d) => (pick(d) > 0 && (best === null || pick(d) > pick(best)) ? d : best), null)
  const peakExpenseDay = peak((d) => d.expenses)
  return {
    period,
    days,
    totalDeposits: days.reduce((s, d) => s + d.deposits, 0),
    totalExpenses: days.reduce((s, d) => s + d.expenses, 0),
    peakExpenseDay,
    peakExpenseBreakdown: peakExpenseDay
      ? [...(byCategory.get(peakExpenseDay.date) ?? [])]
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'fr'))
      : [],
    peakDepositDay: peak((d) => d.deposits),
  }
}
