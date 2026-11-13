import { DomainError } from '@/domain/errors'
import { addCategory, addTransaction, emptyWallet, setCategoryInitialBalance, setDailyBudget } from '@/domain/ledger'
import type { Workspace } from '@/domain/model'
import { parseWorkspace, serializeWorkspace } from './backup'

const ids = () => { let n = 0; return () => `gen${++n}` }

function sample(): Workspace {
  let w = emptyWallet('w1', 'Principal')
  w = addCategory(addCategory(w, 'bazar'), 'œufs & pâtes')
  w = setDailyBudget(w, 'bazar', 3700)
  w = setCategoryInitialBalance(w, 'bazar', 20000)
  w = addTransaction(w, { date: '2026-09-01', category: 'bazar', kind: 'expense', label: 'pâtes', amount: 1500 }, 't1')
  w = addTransaction(w, { date: '2026-09-02', category: 'bazar', kind: 'deposit', label: '', amount: 52700 }, 't2')
  return { activeWalletId: 'w1', wallets: [{ ...w, initialBalance: 16600 }, emptyWallet('w2', 'Banque')] }
}

const json = (data: unknown) => JSON.stringify({ format: 'repere', version: 1, ...(data as object) })
const wallet = (extra: object = {}) => ({ id: 'w1', name: 'Principal', ...extra })
const tx = (extra: object = {}) => ({ id: 't', date: '2026-09-01', category: 'riz', kind: 'expense', label: '', amount: 100, ...extra })

describe('aller-retour JSON', () => {
  it('exporter puis importer redonne exactement les mêmes données (accents compris)', () => {
    const text = serializeWorkspace(sample(), '2026-10-01T09:00:00.000Z')
    expect(parseWorkspace(text, ids())).toEqual(sample())
    expect(JSON.parse(text)).toMatchObject({ format: 'repere', version: 1, exportedAt: '2026-10-01T09:00:00.000Z' })
  })
})

describe('lecture tolérante', () => {
  it('accepte un fichier minimal : identifiants générés, catégories déduites des transactions', () => {
    const ws = parseWorkspace(json({ wallets: [{ name: 'Perso', transactions: [{ date: '2026-09-01', category: 'riz', kind: 'expense', amount: 100 }] }] }), ids())
    expect(ws.wallets[0]!.categories).toEqual([{ name: 'riz', dailyBudget: 0, initialBalance: 0 }])
    expect(ws.wallets[0]!.transactions[0]!.id).toBe('gen2')
    expect(ws.activeWalletId).toBe('gen1')
  })

  it('catégories données comme simples textes, types en français, montants décimaux arrondis', () => {
    const ws = parseWorkspace(json({ wallets: [wallet({ categories: ['riz', 'Riz', { name: 'bazar', dailyBudget: 500 }], transactions: [tx({ kind: 'dépôt', amount: 99.6 }), tx({ id: 'u', kind: 'dépense' })] })] }), ids())
    expect(ws.wallets[0]!.categories).toEqual([{ name: 'bazar', dailyBudget: 500, initialBalance: 0 }, { name: 'riz', dailyBudget: 0, initialBalance: 0 }])
    expect(ws.wallets[0]!.transactions.map((t) => [t.kind, t.amount])).toEqual([['deposit', 100], ['expense', 100]])
  })

  it('solde de départ d\'une catégorie : absent = 0, présent = conservé', () => {
    const ws = parseWorkspace(json({ wallets: [wallet({ categories: [{ name: 'riz' }, { name: 'bazar', initialBalance: 20000 }, 'huile'] })] }), ids())
    expect(ws.wallets[0]!.categories.map((c) => [c.name, c.initialBalance])).toEqual([['bazar', 20000], ['huile', 0], ['riz', 0]])   // triées par nom
  })

  it('identifiants en double remplacés, noms de portefeuilles en double renommés, portefeuille actif de secours', () => {
    const ws = parseWorkspace(json({ activeWalletId: 'inconnu', wallets: [wallet({ transactions: [tx(), tx()] }), wallet()] }), ids())
    const [first, second] = ws.wallets
    expect(new Set(first!.transactions.map((t) => t.id)).size).toBe(2)
    expect([first!.name, second!.name]).toEqual(['Principal', 'Principal (2)'])
    expect(first!.id).not.toBe(second!.id)
    expect(ws.activeWalletId).toBe(first!.id)
  })
})

describe('lecture stricte : rien qui rendrait les comptes faux', () => {
  const rejects = (text: string, message: RegExp | string) => {
    expect(() => parseWorkspace(text, ids())).toThrow(DomainError)
    expect(() => parseWorkspace(text, ids())).toThrow(message)
  }

  it('fichier invalide, étranger ou trop récent', () => {
    rejects('{pas du json', 'JSON valide')
    rejects(JSON.stringify({ wallets: [] }), 'pas une sauvegarde Repère')
    rejects('[]', 'pas une sauvegarde Repère')
    rejects(JSON.stringify({ format: 'repere', version: 2, wallets: [wallet()] }), 'plus récente')
    rejects(json({ wallets: [] }), 'aucun portefeuille')
  })

  it('dates impossibles, montants invalides, types inconnus : le message dit où', () => {
    rejects(json({ wallets: [wallet({ transactions: [tx(), tx({ date: '2026-02-30' })] })] }), /Principal.*transaction n°2.*date invalide/)
    rejects(json({ wallets: [wallet({ transactions: [tx({ amount: 0 })] })] }), 'montant invalide')
    rejects(json({ wallets: [wallet({ transactions: [tx({ amount: -5 })] })] }), 'montant invalide')
    rejects(json({ wallets: [wallet({ transactions: [tx({ amount: '100' })] })] }), 'montant invalide')
    rejects(json({ wallets: [wallet({ transactions: [tx({ kind: 'virement' })] })] }), 'type inconnu')
    rejects(json({ wallets: [wallet({ transactions: [tx({ category: '  ' })] })] }), 'catégorie manquante')
  })

  it('structure incohérente', () => {
    rejects(json({ wallets: [{ id: 'x' }] }), 'nom manquant')
    rejects(json({ wallets: [wallet({ initialBalance: 1.5 })] }), 'solde initial')
    rejects(json({ wallets: [wallet({ categories: [{ name: 'a', dailyBudget: -1 }] })] }), 'négatif')
    rejects(json({ wallets: [wallet({ categories: [{ name: 'a', initialBalance: -1 }] })] }), 'solde de départ')
    rejects(json({ wallets: [wallet({ categories: [{ name: 'a', initialBalance: 1.5 }] })] }), 'solde de départ')
    rejects(json({ wallets: [wallet({ categories: [{ name: 'a', initialBalance: '500' }] })] }), 'solde de départ')
    rejects(json({ wallets: [wallet({ transactions: 'x' })] }), 'transactions est invalide')
  })
})
