import * as ledger from './ledger'
import { makePeriod } from './period'
import { balanceAt, balanceByDate, categoryBalances, startingBalance, totalBalance } from './services/balances'
import { depositLabel, proposeBudget } from './services/budget'
import { budgetShares, flows } from './services/dashboard'
import { buildReport } from './services/reports'
import { analyzeSpending, diagnose, statisticsOf } from './services/spending'
import type { Wallet } from './model'

let counter = 0
function build(initial: number, rows: [string, string, 'expense' | 'deposit', number, string?][], categories: string[]): Wallet {
  let w = ledger.setInitialBalance(ledger.emptyWallet('w', 'T'), initial)
  for (const c of categories) w = ledger.addCategory(w, c)
  for (const [date, category, kind, amount, label] of rows) w = ledger.addTransaction(w, { date, category, kind, label: label ?? '', amount }, `t${++counter}`)
  return w
}

const sample = () => build(1000, [
  ['2026-09-01', 'bazar', 'deposit', 10000], ['2026-09-01', 'bazar', 'expense', 3000, 'riz'],
  ['2026-09-03', 'bazar', 'expense', 1000, 'riz'], ['2026-09-03', 'gouter', 'expense', 500, 'wifi'],
], ['bazar', 'gouter'])

describe('soldes', () => {
  it('par date, à une date, total', () => {
    const w = sample()
    expect(balanceByDate(w).map((d) => d.balance)).toEqual([8000, 6500])
    expect(balanceAt(w, '2026-09-02')).toBe(8000)
    expect(balanceAt(w, '2026-08-01')).toBe(1000)
    expect(totalBalance(w)).toBe(6500)
  })
})

describe('solde de départ des catégories', () => {
  // 1 000 hors catégories + 20 000 dans « bazar » : le solde de départ du portefeuille est leur somme.
  const withStart = () => ledger.setCategoryInitialBalance(sample(), 'bazar', 20000)

  it('compte dans le solde de la catégorie ET dans les soldes du portefeuille', () => {
    const w = withStart()
    expect(startingBalance(w)).toBe(21000)
    expect(categoryBalances(w).get('bazar')).toBe(26000)   // 20 000 + 10 000 − 3 000 − 1 000
    expect(categoryBalances(w).get('gouter')).toBe(-500)
    expect(balanceAt(w, '2026-08-01')).toBe(21000)
    expect(balanceByDate(w).map((d) => d.balance)).toEqual([28000, 26500])
    expect(totalBalance(w)).toBe(26500)
  })

  it('le total du portefeuille = solde initial + somme des soldes des catégories', () => {
    const w = withStart()
    const sum = [...categoryBalances(w).values()].reduce((a, b) => a + b, 0)
    expect(totalBalance(w)).toBe(w.initialBalance + sum)
  })

  it('compte dans le solde d\'ouverture du rapport et réduit la suggestion du budget', () => {
    const w = ledger.setDailyBudget(withStart(), 'bazar', 3700)
    expect(buildReport(w, makePeriod('2026-09-02', '2026-09-03')).openingBalance).toBe(28000)
    const [line] = proposeBudget(w, makePeriod('2026-10-01', '2026-10-07'))
    expect([line!.needed, line!.balance, line!.suggestion]).toEqual([25900, 26000, 0])
    const [poorer] = proposeBudget(ledger.setCategoryInitialBalance(w, 'bazar', 10000), makePeriod('2026-10-01', '2026-10-07'))
    expect([poorer!.balance, poorer!.suggestion]).toEqual([16000, 9900])
  })
})

describe('tableau de bord', () => {
  const w = build(0, [
    ...(['Alimentation', 'Transport', 'Électricité', 'Loisirs', 'Imprévus'] as const).map((c, i): [string, string, 'deposit', number] =>
      ['2026-10-14', c, 'deposit', [30000, 20000, 20000, 10000, 10000][i]!]),
    ['2026-10-15', 'Alimentation', 'expense', 12000], ['2026-10-20', 'Électricité', 'expense', 4000, 'Jirama'],
    ['2026-10-20', 'Imprévus', 'expense', 14000, 'panne'],
  ], ['Alimentation', 'Transport', 'Électricité', 'Loisirs', 'Imprévus'])

  it('soldes restants : positifs pour le camembert, déficits à part', () => {
    const shares = budgetShares(w)
    expect(shares.items.map((i) => [i.category, i.balance])).toEqual([['Transport', 20000], ['Alimentation', 18000], ['Électricité', 16000], ['Loisirs', 10000]])
    expect(shares.total).toBe(64000)
    expect(shares.deficits).toEqual([{ category: 'Imprévus', amount: 4000 }])
    expect(shares.items.reduce((s, i) => s + i.share, 0)).toBeCloseTo(100, 0)
  })

  it('un solde nul n\'apparaît pas', () => {
    const z = build(0, [['2026-01-01', 'a', 'deposit', 100], ['2026-01-02', 'a', 'expense', 100]], ['a'])
    expect(budgetShares(z).items).toEqual([])
  })

  it('flux : un point par jour (zéros compris), totaux et pic détaillé', () => {
    const series = flows(w, makePeriod('2026-10-14', '2026-10-20'))
    expect(series.days).toHaveLength(7)
    expect(series.days.map((d) => d.expenses)).toEqual([0, 12000, 0, 0, 0, 0, 18000])
    expect([series.totalDeposits, series.totalExpenses]).toEqual([90000, 30000])
    expect(series.peakExpenseDay?.date).toBe('2026-10-20')
    expect(series.peakExpenseBreakdown).toEqual([{ category: 'Imprévus', amount: 14000 }, { category: 'Électricité', amount: 4000 }])
  })

  it('le filtre de dates restreint les totaux', () => {
    const series = flows(w, makePeriod('2026-10-16', '2026-10-19'))
    expect([series.totalDeposits, series.totalExpenses, series.peakExpenseDay]).toEqual([0, 0, null])
  })
})

describe('rapport', () => {
  it('soldes d\'ouverture et de clôture, parts, moyenne par jour', () => {
    const r = buildReport(sample(), makePeriod('2026-09-02', '2026-09-03'))
    expect([r.openingBalance, r.closingBalance]).toEqual([8000, 6500])
    expect([r.totalDeposits, r.totalExpenses, r.transactionCount]).toEqual([0, 1500, 2])
    expect(r.categories.map((c) => c.category)).toEqual(['bazar', 'gouter'])
    expect(r.categories[0]!.expenseShare).toBe(66.7)
    expect(r.averageDailyExpense).toBe(750)
    expect(r.topExpenses[0]).toEqual({ category: 'bazar', label: 'riz', amount: 1000 })
  })
})

describe('budget', () => {
  it("l'exemple : gouter 500 Ar/jour, 1 000 Ar restants, 7 jours → 7×500 − 1 000 = 2 500", () => {
    const w = ledger.setDailyBudget(build(0, [['2026-09-30', 'gouter', 'deposit', 3000], ['2026-09-30', 'gouter', 'expense', 2000]], ['gouter']), 'gouter', 500)
    const [line] = proposeBudget(w, makePeriod('2026-10-01', '2026-10-07'))
    expect([line!.needed, line!.balance, line!.suggestion]).toEqual([3500, 1000, 2500])
  })

  it('la suggestion n\'est jamais négative et un déficit est comblé', () => {
    const rich = ledger.setDailyBudget(build(0, [['2026-09-30', 'a', 'deposit', 99999]], ['a']), 'a', 100)
    expect(proposeBudget(rich, makePeriod('2026-10-01', '2026-10-03'))[0]!.suggestion).toBe(0)
    const poor = ledger.setDailyBudget(build(0, [['2026-09-30', 'a', 'expense', 500]], ['a']), 'a', 1000)
    expect(proposeBudget(poor, makePeriod('2026-10-01', '2026-10-07'))[0]!.suggestion).toBe(7500)
  })

  it('libellé des dépôts', () => {
    expect(depositLabel(makePeriod('2026-10-01', '2026-10-07'))).toBe('Budget du 01/10/2026 au 07/10/2026')
  })
})

describe('analyse des dépenses', () => {
  it('les jours sans dépense comptent pour 0 ; moyenne, écart-type, niveaux arrondis à 100 Ar', () => {
    const a = analyzeSpending(sample(), 'bazar', makePeriod('2026-09-01', '2026-09-03'))
    expect(a.daily.map((d) => d.amount)).toEqual([3000, 0, 1000])
    expect(a.stats.suggestions).toEqual({ tight: 1300, balanced: 2100, comfortable: 2900 })
    expect(a.stats.daysWithExpense).toBe(2)
    expect(a.stats.std).toBeCloseTo(1527.53, 1)
  })

  it('statistiques simples et cas limites', () => {
    const s = statisticsOf([0, 10, 20, 30])
    expect([s.mean, s.median, s.minimum, s.maximum, s.daysAboveMean]).toEqual([15, 15, 0, 30, 2])
    expect(statisticsOf([5]).std).toBe(0)
    expect(diagnose(statisticsOf([0, 0, 0]))).toContain('Aucune dépense')
    expect(diagnose(statisticsOf([100, 110, 90, 100]))).toContain('régulières')
    expect(diagnose(statisticsOf([0, 0, 0, 0, 0, 0, 0, 0, 1000]))).toContain('très irrégulières')
  })
})
