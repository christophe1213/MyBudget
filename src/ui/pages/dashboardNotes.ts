/** Phrases affichées sous les graphiques du tableau de bord. */
import type { BudgetShares, FlowSeries } from '@/domain/services/dashboard'
import { formatAr, formatDayLong } from '@/ui/format'

export function sharesNote(shares: BudgetShares): string {
  let note = `Base : ${formatAr(shares.total)} de soldes restants répartis sur ${shares.items.length} budget(s).`
  if (shares.deficits.length > 0) {
    note += ` Les ${formatAr(shares.deficitTotal)} en déficit (${shares.deficits.map((d) => d.category).join(', ')}) ne font pas partie du camembert.`
  }
  return note
}

export function flowsNote(series: FlowSeries): string {
  const parts = ['Montants par jour, en Ar.']
  if (series.peakExpenseDay) {
    const detail = series.peakExpenseBreakdown.map((b) => `${b.category} ${formatAr(b.amount)}`).join(' + ')
    parts.push(`Le ${formatDayLong(series.peakExpenseDay.date)} : ${detail}.`)
  } else parts.push('Aucune sortie sur cette période.')
  parts.push(series.peakDepositDay
    ? `Plus forte entrée : le ${formatDayLong(series.peakDepositDay.date)} (${formatAr(series.peakDepositDay.deposits)}).`
    : 'Entrées : 0 Ar à chaque date.')
  return parts.join(' ')
}
