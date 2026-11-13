import { DomainError } from './errors'
import * as ledger from './ledger'
import type { Wallet } from './model'
import * as workspace from './workspace'

const fresh = (): Wallet => ledger.addCategory(ledger.addCategory(ledger.emptyWallet('w1', 'Principal'), 'riz'), 'bazar')
const tx = (date: string, category: string, kind: 'expense' | 'deposit', amount: number, label = '') => ({ date, category, kind, label, amount })

describe('catégories', () => {
  it('sont uniques sans tenir compte de la casse, triées, et le nom est nettoyé', () => {
    const w = ledger.addCategory(fresh(), '  Épargne   BNI ')
    expect(w.categories.map((c) => c.name)).toEqual(['bazar', 'Épargne BNI', 'riz'])
    expect(() => ledger.addCategory(w, 'RIZ')).toThrow(DomainError)
    expect(() => ledger.addCategory(w, '   ')).toThrow('vide')
  })

  it('renommer déplace les transactions et le budget', () => {
    let w = ledger.setDailyBudget(fresh(), 'bazar', 3700)
    w = ledger.addTransaction(w, tx('2026-09-01', 'bazar', 'expense', 500), 't1')
    const renamed = ledger.renameCategory(w, 'bazar', 'marché')
    expect(renamed.transactions[0]!.category).toBe('marché')
    expect(ledger.dailyBudget(renamed, 'marché')).toBe(3700)
    expect(() => ledger.renameCategory(renamed, 'marché', 'riz')).toThrow('existe déjà')
  })

  it("une catégorie utilisée ne peut pas être supprimée", () => {
    const w = ledger.addTransaction(fresh(), tx('2026-09-01', 'riz', 'expense', 100), 't1')
    expect(() => ledger.removeCategory(w, 'riz')).toThrow('1 transaction')
    expect(ledger.removeCategory(w, 'bazar').categories.map((c) => c.name)).toEqual(['riz'])
  })

  it('le budget par jour doit être un entier positif ou nul ; 0 le supprime', () => {
    expect(() => ledger.setDailyBudget(fresh(), 'riz', -1)).toThrow(DomainError)
    expect(() => ledger.setDailyBudget(fresh(), 'riz', 1.5)).toThrow(DomainError)
    expect(() => ledger.setDailyBudget(fresh(), 'inconnue', 100)).toThrow('inconnue')
    expect(ledger.dailyBudget(ledger.setDailyBudget(ledger.setDailyBudget(fresh(), 'riz', 500), 'riz', 0), 'riz')).toBe(0)
  })

  it('le solde de départ doit être un entier positif ou nul ; il suit la catégorie quand on la renomme', () => {
    expect(() => ledger.setCategoryInitialBalance(fresh(), 'riz', -1)).toThrow(DomainError)
    expect(() => ledger.setCategoryInitialBalance(fresh(), 'riz', 1.5)).toThrow(DomainError)
    expect(() => ledger.setCategoryInitialBalance(fresh(), 'inconnue', 100)).toThrow('inconnue')
    const w = ledger.setCategoryInitialBalance(fresh(), 'riz', 20000)
    expect(w.categories.map((c) => [c.name, c.initialBalance])).toEqual([['bazar', 0], ['riz', 20000]])
    expect(ledger.renameCategory(w, 'riz', 'céréales').categories.find((c) => c.name === 'céréales')!.initialBalance).toBe(20000)
    expect(ledger.setCategoryInitialBalance(w, 'riz', 0).categories.find((c) => c.name === 'riz')!.initialBalance).toBe(0)
  })
})

describe('transactions', () => {
  it('valident la catégorie, le montant et la date', () => {
    const w = fresh()
    expect(() => ledger.addTransaction(w, tx('2026-09-01', 'inconnue', 'expense', 100), 'x')).toThrow('catégorie')
    for (const amount of [0, -5, 1.5, Number.NaN]) {
      expect(() => ledger.addTransaction(w, tx('2026-09-01', 'riz', 'expense', amount), 'x')).toThrow('Montant')
    }
    expect(() => ledger.addTransaction(w, tx('2026-02-30', 'riz', 'expense', 100), 'x')).toThrow('Date')
  })

  it('un dépôt sans libellé reçoit « dépôt »', () => {
    expect(ledger.addTransaction(fresh(), tx('2026-09-01', 'riz', 'deposit', 100), 'x').transactions[0]!.label).toBe('dépôt')
  })

  it('les fonctions ne modifient jamais leur argument', () => {
    const before = fresh()
    const snapshot = JSON.stringify(before)
    ledger.addTransaction(before, tx('2026-09-01', 'riz', 'expense', 100), 'x')
    ledger.renameCategory(before, 'riz', 'blé')
    ledger.removeCategory(before, 'riz')
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('supprimer par identifiant', () => {
    let w = ledger.addTransaction(fresh(), tx('2026-09-01', 'riz', 'expense', 100), 'a')
    w = ledger.addTransaction(w, tx('2026-09-01', 'riz', 'expense', 200), 'b')
    expect(ledger.removeTransactions(w, ['a']).transactions.map((t) => t.id)).toEqual(['b'])
  })
})

describe('portefeuilles', () => {
  const ws = workspace.createWorkspace('w1')

  it('noms uniques, dernier portefeuille protégé, activation', () => {
    const two = workspace.addWallet(ws, 'w2', 'Banque')
    expect(two.activeWalletId).toBe('w2')
    expect(() => workspace.addWallet(two, 'w3', 'banque')).toThrow('existe déjà')
    expect(() => workspace.removeWallet(ws, 'w1')).toThrow('dernier')
    expect(workspace.removeWallet(two, 'w2').activeWalletId).toBe('w1')
    expect(workspace.renameWallet(two, 'w2', 'Caisse').wallets[1]!.name).toBe('Caisse')
  })

  it('fusionner renomme les doublons et change les identifiants déjà pris', () => {
    const other = workspace.addWallet(workspace.createWorkspace('w1'), 'w9', 'Banque')
    let n = 0
    const merged = workspace.mergeWorkspaces(ws, other, () => `new${++n}`)
    expect(merged.wallets.map((w) => [w.id, w.name])).toEqual([['w1', 'Principal'], ['new1', 'Principal (2)'], ['w9', 'Banque']])
    expect(merged.activeWalletId).toBe('w1')
  })
})
