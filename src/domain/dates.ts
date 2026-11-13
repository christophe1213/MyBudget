/** Dates calendaires « AAAA-MM-JJ » : pas de fuseau horaire, donc pas de décalage d'un jour. */
export type IsoDate = string

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

const toMs = (d: IsoDate): number => Date.parse(`${d}T00:00:00Z`)
const fromMs = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10)

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const m = ISO.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

export const addDays = (d: IsoDate, n: number): IsoDate => fromMs(toMs(d) + n * DAY_MS)

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export const diffDays = (from: IsoDate, to: IsoDate): number => Math.round((toMs(to) - toMs(from)) / DAY_MS)

export const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b)
export const maxDate = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b)

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  return days
}

/** Les chaînes ISO se comparent correctement par ordre alphabétique. */
export const compareDates = (a: IsoDate, b: IsoDate): number => (a < b ? -1 : a > b ? 1 : 0)
