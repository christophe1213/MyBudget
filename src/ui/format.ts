/** Mise en forme pour l'AFFICHAGE (le domaine ne manipule que des nombres et des dates ISO). */
import type { IsoDate } from '@/domain/dates'

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** 30 000 (espace insécable : le montant ne se coupe jamais en fin de ligne). */
export const formatNumber = (n: number): string => number.format(Math.round(n)).replace(/[\u202f\u00a0]/g, '\u00a0')

/** 30 000 Ar */
export const formatAr = (n: number): string => `${formatNumber(n)}\u00a0Ar`

/** +30 000 Ar / −4 000 Ar */
export const formatSigned = (n: number): string => `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${formatAr(Math.abs(n))}`

/** 33,3 % */
export const formatPercent = (value: number): string => `${value.toFixed(1).replace('.', ',')}\u00a0%`

const parts = (d: IsoDate): [number, number, number] => {
  const [y, m, day] = d.split('-').map(Number)
  return [y!, m!, day!]
}

/** 20/10/2026 */
export const formatDate = (d: IsoDate): string => d.split('-').reverse().join('/')

/** 20 oct. */
export const formatDayShort = (d: IsoDate): string => `${parts(d)[2]} ${MONTHS_SHORT[parts(d)[1] - 1]}`

/** 20 octobre */
export const formatDayLong = (d: IsoDate): string => `${parts(d)[2]} ${MONTHS[parts(d)[1] - 1]}`

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** mardi 20 octobre 2026 */
export function formatDayFull(d: IsoDate): string {
  const [y, m, day] = parts(d)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]} ${day} ${MONTHS[m - 1]} ${y}`
}

/** Lit un montant saisi : « 3 200 », « 3200 Ar »… Retourne null si ce n'est pas un entier positif. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/[\s\u00a0\u202fA-Za-z.,]/g, '')
  return /^\d+$/.test(digits) && Number(digits) > 0 ? Number(digits) : null
}

/** Idem, mais 0 est accepté (budget supprimé, solde initial nul). Champ vide = 0. */
export function parseAmountOrZero(text: string): number | null {
  const trimmed = text.replace(/[\s\u00a0\u202f]/g, '')
  return trimmed === '' || trimmed === '0' ? 0 : parseAmount(text)
}
