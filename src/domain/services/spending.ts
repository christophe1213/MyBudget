/** Analyse des dépenses journalières d'une catégorie pour définir un budget par jour. */
import { eachDay, type IsoDate } from '../dates'
import type { Wallet } from '../model'
import { periodContains, type Period } from '../period'

export interface SpendingSuggestions {
  /** La moyenne. */
  readonly tight: number
  /** Moyenne + ½ écart-type. */
  readonly balanced: number
  /** Moyenne + 1 écart-type. */
  readonly comfortable: number
}

export interface SpendingStats {
  readonly days: number
  readonly daysWithExpense: number
  readonly total: number
  readonly mean: number
  readonly median: number
  readonly std: number
  readonly minimum: number
  readonly maximum: number
  /** Écart-type / moyenne. */
  readonly variability: number
  readonly daysAboveMean: number
  readonly suggestions: SpendingSuggestions
}

export interface SpendingAnalysis {
  readonly category: string
  readonly period: Period
  /** Dépense de CHAQUE jour de la période (les jours sans dépense comptent pour 0). */
  readonly daily: readonly { date: IsoDate; amount: number }[]
  readonly stats: SpendingStats
}

const round100 = (x: number): number => Math.floor(x / 100 + 0.5) * 100

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function statisticsOf(values: readonly number[]): SpendingStats {
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const std = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0   // écart-type de l'échantillon
  return {
    days: n,
    daysWithExpense: values.filter((v) => v > 0).length,
    total: values.reduce((s, v) => s + v, 0),
    mean,
    median: median(values),
    std,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    variability: mean > 0 ? std / mean : 0,
    daysAboveMean: values.filter((v) => v > mean).length,
    suggestions: { tight: round100(mean), balanced: round100(mean + 0.5 * std), comfortable: round100(mean + std) },
  }
}

export function analyzeSpending(w: Wallet, category: string, period: Period): SpendingAnalysis {
  const perDay = new Map<IsoDate, number>(eachDay(period.start, period.end).map((d) => [d, 0]))
  for (const t of w.transactions) {
    if (t.category === category && t.kind === 'expense' && periodContains(period, t.date)) perDay.set(t.date, perDay.get(t.date)! + t.amount)
  }
  const daily = [...perDay].map(([date, amount]) => ({ date, amount }))
  return { category, period, daily, stats: statisticsOf(daily.map((d) => d.amount)) }
}

export function diagnose(stats: SpendingStats): string {
  if (stats.total === 0) return 'Aucune dépense sur cette période : impossible de proposer un budget.'
  if (stats.variability < 0.7) return 'Dépenses régulières : la moyenne est un bon budget journalier, les autres niveaux ajoutent peu.'
  if (stats.variability < 1.5) {
    return 'Dépenses assez variables : la moyenne reste la bonne base, car le solde de la catégorie se reporte d\u2019un jour à l\u2019autre. Choisissez « équilibré » si vous voulez une petite marge de sécurité.'
  }
  return 'Dépenses très irrégulières (gros achats ponctuels) : prenez la moyenne comme budget. Le solde reporté absorbe les pics ; le niveau « confortable » serait bien trop élevé pour un jour ordinaire.'
}
