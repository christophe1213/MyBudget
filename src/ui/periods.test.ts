import { addCategory, addTransaction, emptyWallet } from '@/domain/ledger'
import type { Wallet } from '@/domain/model'
import { recentPeriod, tryPeriod, upcomingPeriod, wholePeriod } from './periods'

const wallet = (): Wallet => {
  let w = addCategory(emptyWallet('w', 'T'), 'a')
  for (const date of ['2026-10-01', '2026-10-20']) w = addTransaction(w, { date, category: 'a', kind: 'expense', label: '', amount: 100 }, date)
  return w
}
const empty = (): Wallet => emptyWallet('w', 'T')

describe('périodes par défaut', () => {
  it('toute la période des données, ou aujourd\'hui', () => {
    expect(wholePeriod(wallet(), '2026-11-01')).toEqual({ start: '2026-10-01', end: '2026-10-20' })
    expect(wholePeriod(empty(), '2026-11-01')).toEqual({ start: '2026-11-01', end: '2026-11-01' })
  })

  it('les N derniers jours de données, sans dépasser le début des données', () => {
    expect(recentPeriod(wallet(), '2026-11-01', 7)).toEqual({ start: '2026-10-14', end: '2026-10-20' })
    expect(recentPeriod(wallet(), '2026-11-01', 90)).toEqual({ start: '2026-10-01', end: '2026-10-20' })
    expect(recentPeriod(empty(), '2026-11-01', 7)).toEqual({ start: '2026-11-01', end: '2026-11-01' })
  })

  it('les jours à venir : à partir du lendemain de la dernière transaction', () => {
    expect(upcomingPeriod(wallet(), '2026-11-01', 7)).toEqual({ start: '2026-10-21', end: '2026-10-27' })
    expect(upcomingPeriod(empty(), '2026-11-01', 7)).toEqual({ start: '2026-11-01', end: '2026-11-07' })
  })
})

describe('lecture de deux dates', () => {
  it('valide, inversée, incomplète', () => {
    expect(tryPeriod('2026-10-01', '2026-10-05').period).toEqual({ start: '2026-10-01', end: '2026-10-05' })
    expect(tryPeriod('2026-10-05', '2026-10-01').error).toMatch(/postérieure/)
    expect(tryPeriod('', '2026-10-01').error).toMatch(/Date invalide/)
  })
})
