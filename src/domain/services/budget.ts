/** Planification du budget : suggestion = budget/jour × nombre de jours − solde de la catégorie avant le début. */
import type { Wallet } from '../model'
import { periodDays, type Period } from '../period'
import { categoryBalances } from './balances'

export interface BudgetLine {
  readonly category: string
  readonly daily: number
  readonly days: number
  readonly needed: number
  /** Solde disponible de la catégorie avant le début de la période. */
  readonly balance: number
  /** max(0, needed − balance). */
  readonly suggestion: number
}

export function proposeBudget(w: Wallet, period: Period): BudgetLine[] {
  const balances = categoryBalances(w, period.start)
  const days = periodDays(period)
  return w.categories.map((c) => {
    const needed = c.dailyBudget * days
    const balance = balances.get(c.name) ?? 0
    return { category: c.name, daily: c.dailyBudget, days, needed, balance, suggestion: Math.max(0, needed - balance) }
  })
}

const fr = (d: string): string => d.split('-').reverse().join('/')

export const depositLabel = (p: Period): string => `Budget du ${fr(p.start)} au ${fr(p.end)}`
