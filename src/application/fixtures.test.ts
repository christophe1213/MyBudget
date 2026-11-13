/** Pont avec l'application Python : le JSON qu'elle exporte est lu tel quel, et les soldes sont les mêmes. */
import example from '@/test/fixtures/exemple-excel.json'
import { activeWallet } from '@/domain/workspace'
import { balanceAt, totalBalance } from '@/domain/services/balances'
import { budgetShares } from '@/domain/services/dashboard'
import { parseWorkspace } from './backup'

const ids = () => { let n = 0; return () => `gen${++n}` }

describe('export de l\'application Python (176 transactions de septembre 2026)', () => {
  const wallet = activeWallet(parseWorkspace(JSON.stringify(example), ids()))

  it('est lu sans erreur, catégories et budgets compris', () => {
    expect(wallet.name).toBe('Principal')
    expect(wallet.transactions).toHaveLength(176)
    expect(wallet.categories.map((c) => [c.name, c.dailyBudget])).toEqual([
      ['bazar', 3700], ['bourse', 0], ['gouter', 600], ['kojakoja', 0], ['non distrubué', 0], ['riz', 0],
    ])
  })

  it('donne les MÊMES soldes que l\'application de bureau (vérifiés à la main : 5 800 le 01/09, 13 600 le 29/09)', () => {
    expect(wallet.initialBalance).toBe(16600)
    expect(balanceAt(wallet, '2026-09-01')).toBe(5800)
    expect(balanceAt(wallet, '2026-09-02')).toBe(115900)
    expect(balanceAt(wallet, '2026-09-18')).toBe(110600)
    expect(totalBalance(wallet)).toBe(13600)
  })

  it('alimente le tableau de bord', () => {
    const shares = budgetShares(wallet)
    expect(shares.items.length + shares.deficits.length).toBe(6)
    expect(shares.items.reduce((s, i) => s + i.balance, 0) - shares.deficitTotal + wallet.initialBalance).toBe(13600)
  })
})
