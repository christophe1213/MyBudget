import { addCategory, addTransaction, emptyWallet } from '@/domain/ledger'
import { makePeriod } from '@/domain/period'
import { budgetShares, flows } from '@/domain/services/dashboard'
import { flowsNote, sharesNote } from './dashboardNotes'

const wallet = () => {
  let w = ['Alim', 'Elec', 'Imprévus'].reduce((acc, c) => addCategory(acc, c), emptyWallet('w', 'T'))
  const add = (date: string, category: string, kind: 'expense' | 'deposit', amount: number) => { w = addTransaction(w, { date, category, kind, label: '', amount }, `${date}${category}${kind}`) }
  add('2026-10-14', 'Alim', 'deposit', 30000); add('2026-10-14', 'Elec', 'deposit', 20000); add('2026-10-14', 'Imprévus', 'deposit', 10000)
  add('2026-10-20', 'Elec', 'expense', 4000); add('2026-10-20', 'Imprévus', 'expense', 14000)
  return w
}

describe('notes du tableau de bord', () => {
  it('camembert : base et déficits expliqués', () => {
    expect(sharesNote(budgetShares(wallet()))).toBe(
      'Base : 46\u00a0000\u00a0Ar de soldes restants répartis sur 2 budget(s). Les 4\u00a0000\u00a0Ar en déficit (Imprévus) ne font pas partie du camembert.')
  })

  it('courbes : pic des sorties détaillé par catégorie, plus forte entrée', () => {
    const note = flowsNote(flows(wallet(), makePeriod('2026-10-14', '2026-10-20')))
    expect(note).toContain('Le 20 octobre : Imprévus 14\u00a0000\u00a0Ar + Elec 4\u00a0000\u00a0Ar.')
    expect(note).toContain('Plus forte entrée : le 14 octobre (60\u00a0000\u00a0Ar).')   // 30 000 + 20 000 + 10 000 le même jour
  })

  it('période sans mouvement', () => {
    expect(flowsNote(flows(wallet(), makePeriod('2026-10-16', '2026-10-18')))).toBe('Montants par jour, en Ar. Aucune sortie sur cette période. Entrées : 0 Ar à chaque date.')
  })
})
