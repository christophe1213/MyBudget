/** Persistance RÉELLE : le service branché sur le localStorage (jsdom) retrouve ses données au « redémarrage ». */
import { WorkspaceService } from '@/application/workspaceService'
import { activeWallet } from '@/domain/workspace'
import { FakeFiles, FixedClock, SequenceIds } from '@/test/fakes'
import { LocalStorageRepository, STORAGE_KEY } from './localStorageRepository'

function launch() {
  const ids = new SequenceIds()
  const files = new FakeFiles()
  const service = new WorkspaceService({ repository: new LocalStorageRepository(localStorage, () => ids.next()), clock: new FixedClock(), ids, files })
  service.start()
  return { service, files }
}

beforeEach(() => localStorage.clear())

describe('stockage local : données conservées entre deux lancements', () => {
  it('transactions, catégories, budgets et portefeuilles sont retrouvés', () => {
    const first = launch().service
    first.addCategory('Transport')
    first.setDailyBudget('Transport', 3700)
    first.addTransaction({ date: '2026-10-01', category: 'Transport', kind: 'expense', label: 'taxi', amount: 5000 })
    first.createWallet('Banque')

    const second = launch().service                                          // « on rouvre l'application »
    expect(second.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Banque'])
    expect(second.getSnapshot().activeWalletId).toBe(first.getSnapshot().activeWalletId)
    second.switchWallet(second.getSnapshot().wallets[0]!.id)
    expect(activeWallet(second.getSnapshot()).categories).toEqual([{ name: 'Transport', dailyBudget: 3700 }])
    expect(activeWallet(second.getSnapshot()).transactions[0]).toMatchObject({ label: 'taxi', amount: 5000, date: '2026-10-01' })
  })

  it('le contenu du stockage est exactement le JSON exportable : on peut l\'exporter puis le réimporter ailleurs', () => {
    const { service, files } = launch()
    service.addCategory('riz')
    service.addTransaction({ date: '2026-10-01', category: 'riz', kind: 'deposit', label: '', amount: 100 })
    service.exportBackup()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    const exported = JSON.parse(files.downloads[0]!.content)
    expect(exported.wallets).toEqual(stored.wallets)

    localStorage.clear()                                                      // autre appareil, vide
    const other = launch()
    other.service.applyImport(other.service.previewImport('x.json', files.downloads[0]!.content), 'replace')
    expect(activeWallet(other.service.getSnapshot()).transactions[0]).toMatchObject({ amount: 100, label: 'dépôt' })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).wallets[0].transactions).toHaveLength(1)   // et c'est enregistré
  })

  it('un autre onglet qui modifie les données est pris en compte', () => {
    const a = launch().service
    a.addCategory('riz')
    const b = launch().service
    b.addCategory('bazar')
    const stored = localStorage.getItem(STORAGE_KEY)!
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: stored }))
    expect(activeWallet(a.getSnapshot()).categories.map((c) => c.name)).toEqual(['bazar', 'riz'])
  })

  it('données corrompues : l\'application démarre, prévient, et garde une copie', () => {
    localStorage.setItem(STORAGE_KEY, '{cassé')
    const { service } = launch()
    expect(service.warning).toMatch(/illisibles/)
    expect(activeWallet(service.getSnapshot()).name).toBe('Principal')
    expect(Object.keys(localStorage).some((k) => k.startsWith(`${STORAGE_KEY}.illisible-`))).toBe(true)
  })
})
