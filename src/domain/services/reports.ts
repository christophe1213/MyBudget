/** Rapport de période : sommes des dépôts et des dépenses par catégorie. */
import { signedAmount, type Wallet } from '../model'
import { periodContains, periodDays, type Period } from '../period'

export interface CategoryTotals {
  readonly category: string
  readonly deposits: number
  readonly expenses: number
  readonly net: number
  /** Part des dépenses totales, en %, arrondie à une décimale. */
  readonly expenseShare: number
  readonly count: number
}

export interface Report {
  readonly period: Period
  readonly openingBalance: number
  readonly closingBalance: number
  readonly totalDeposits: number
  readonly totalExpenses: number
  readonly net: number
  readonly averageDailyExpense: number
  readonly transactionCount: number
  readonly categories: readonly CategoryTotals[]
  readonly topExpenses: readonly { category: string; label: string; amount: number }[]
}

export const TOP_EXPENSES = 10

export function buildReport(w: Wallet, period: Period): Report {
  const openingBalance = w.initialBalance + w.transactions.filter((t) => t.date < period.start).reduce((s, t) => s + signedAmount(t), 0)
  const totals = new Map<string, { deposits: number; expenses: number; count: number }>()
  const byLabel = new Map<string, { category: string; label: string; amount: number }>()
  for (const t of w.transactions) {
    if (!periodContains(period, t.date)) continue
    const row = totals.get(t.category) ?? { deposits: 0, expenses: 0, count: 0 }
    if (t.kind === 'deposit') row.deposits += t.amount
    else {
      row.expenses += t.amount
      const key = `${t.category}\u0000${t.label}`
      const item = byLabel.get(key) ?? { category: t.category, label: t.label, amount: 0 }
      item.amount += t.amount
      byLabel.set(key, item)
    }
    row.count += 1
    totals.set(t.category, row)
  }
  const totalExpenses = [...totals.values()].reduce((s, r) => s + r.expenses, 0)
  const totalDeposits = [...totals.values()].reduce((s, r) => s + r.deposits, 0)
  const categories = [...totals]
    .map(([category, r]): CategoryTotals => ({
      category, deposits: r.deposits, expenses: r.expenses, net: r.deposits - r.expenses, count: r.count,
      expenseShare: totalExpenses ? Math.round((r.expenses / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.expenses - a.expenses || a.category.localeCompare(b.category, 'fr'))
  const net = totalDeposits - totalExpenses
  return {
    period, openingBalance, closingBalance: openingBalance + net, totalDeposits, totalExpenses, net,
    averageDailyExpense: Math.round(totalExpenses / periodDays(period)),
    transactionCount: categories.reduce((s, c) => s + c.count, 0),
    categories,
    topExpenses: [...byLabel.values()].sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'fr')).slice(0, TOP_EXPENSES),
  }
}
