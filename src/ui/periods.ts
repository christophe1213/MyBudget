/** Périodes proposées par défaut et lecture des dates saisies. */
import { addDays, maxDate, type IsoDate } from '@/domain/dates'
import { DomainError } from '@/domain/errors'
import { dateRange } from '@/domain/ledger'
import type { Wallet } from '@/domain/model'
import { makePeriod, type Period } from '@/domain/period'

export function tryPeriod(start: string, end: string): { period: Period | null; error: string | null } {
  try {
    return { period: makePeriod(start, end), error: null }
  } catch (e) {
    return { period: null, error: e instanceof DomainError ? e.message : 'Période invalide.' }
  }
}

/** Toute la période couverte par les transactions (ou aujourd'hui s'il n'y en a pas). */
export function wholePeriod(wallet: Wallet, today: IsoDate): Period {
  const range = dateRange(wallet)
  return range ? { start: range.start, end: range.end } : { start: today, end: today }
}

/** Les `days` derniers jours de données (ou toute la période si elle est plus courte). */
export function recentPeriod(wallet: Wallet, today: IsoDate, days: number): Period {
  const range = dateRange(wallet)
  if (!range) return { start: today, end: today }
  return { start: maxDate(range.start, addDays(range.end, -(days - 1))), end: range.end }
}

/** `days` jours à partir du lendemain de la dernière transaction (ou d'aujourd'hui). */
export function upcomingPeriod(wallet: Wallet, today: IsoDate, days = 7): Period {
  const range = dateRange(wallet)
  const start = range ? addDays(range.end, 1) : today
  return { start, end: addDays(start, days - 1) }
}
