import { DomainError } from './errors'
import { diffDays, isIsoDate, type IsoDate } from './dates'

/** Intervalle de dates, bornes incluses. */
export interface Period {
  readonly start: IsoDate
  readonly end: IsoDate
}

export function makePeriod(start: string, end: string): Period {
  if (!isIsoDate(start) || !isIsoDate(end)) throw new DomainError('Date invalide : choisissez deux dates.')
  if (end < start) throw new DomainError('La date de fin doit être postérieure à la date de début.')
  return { start, end }
}

export const periodDays = (p: Period): number => diffDays(p.start, p.end) + 1
export const periodContains = (p: Period, d: IsoDate): boolean => d >= p.start && d <= p.end
