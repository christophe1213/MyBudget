import { DomainError } from '@/domain/errors'
import { activeWallet } from '@/domain/workspace'
import { makePeriod } from '@/domain/period'
import { StorageError } from './ports'
import { createTestService } from '@/test/fakes'

function withCategories(...names: string[]) {
  const ctx = createTestService()
  names.forEach((n) => ctx.service.addCategory(n))
  return ctx
}

const expense = (amount: number, category = 'riz', date = '2026-10-01') => ({ date, category, kind: 'expense' as const, label: 'x', amount })

describe('démarrage', () => {
  it('premier lancement : un portefeuille « Principal » vide, déjà enregistré', () => {
    const { service, repository } = createTestService()
    expect(activeWallet(service.getSnapshot()).name).toBe('Principal')
    expect(repository.saved).not.toBeNull()
  })

  it('transmet l\'avertissement du stockage', () => {
    const { service, repository } = createTestService()
    repository.warning = 'données illisibles'
    service.start()
    expect(service.warning).toBe('données illisibles')
  })
})

describe('commandes : enregistrer d\'abord, adopter ensuite', () => {
  it('une transaction est enregistrée et les abonnés sont prévenus', () => {
    const { service, repository } = withCategories('riz')
    const listener = vi.fn()
    service.subscribe(listener)
    service.addTransaction(expense(500))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(activeWallet(repository.saved!).transactions).toHaveLength(1)
    expect(service.getSnapshot()).toBe(repository.saved)
  })

  it('une règle non respectée ne modifie ni l\'état ni le stockage', () => {
    const { service, repository } = withCategories('riz')
    const before = service.getSnapshot()
    const saves = repository.saves
    expect(() => service.addTransaction(expense(0))).toThrow(DomainError)
    expect(service.getSnapshot()).toBe(before)
    expect(repository.saves).toBe(saves)
  })

  it('un échec d\'écriture laisse l\'état intact et le service reste utilisable', () => {
    const { service, repository } = withCategories('riz')
    const before = service.getSnapshot()
    repository.failWith = new StorageError('Espace de stockage plein', 'quota')
    const listener = vi.fn()
    service.subscribe(listener)
    expect(() => service.addTransaction(expense(500))).toThrow('plein')
    expect(service.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    repository.failWith = null
    service.addTransaction(expense(500))
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(1)
  })

  it('un abonné peut se désabonner', () => {
    const { service } = createTestService()
    const listener = vi.fn()
    service.subscribe(listener)()
    service.addCategory('riz')
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('budget : solde de départ d\'une catégorie', () => {
  it('est enregistré avec la catégorie ; une valeur invalide ne modifie ni l\'état ni le stockage', () => {
    const { service, repository } = withCategories('riz')
    service.setCategoryInitialBalance('riz', 20000)
    expect(activeWallet(repository.saved!).categories[0]!.initialBalance).toBe(20000)
    const before = service.getSnapshot()
    expect(() => service.setCategoryInitialBalance('riz', -5)).toThrow(DomainError)
    expect(() => service.setCategoryInitialBalance('inconnue', 5)).toThrow(DomainError)
    expect(service.getSnapshot()).toBe(before)
    expect(repository.saved).toBe(before)
  })
})

describe('budget : dépôts', () => {
  it('crée un dépôt par catégorie à montant > 0, daté du début, avec le libellé de période', () => {
    const { service } = withCategories('gouter', 'riz')
    const created = service.createDeposits(makePeriod('2026-10-01', '2026-10-07'), [['gouter', 3000], ['riz', 0]])
    expect(created).toBe(1)
    expect(activeWallet(service.getSnapshot()).transactions[0]).toMatchObject({ kind: 'deposit', amount: 3000, date: '2026-10-01', label: 'Budget du 01/10/2026 au 07/10/2026' })
  })
})

describe('portefeuilles', () => {
  it('créer, changer, renommer, retirer — chaque portefeuille a ses propres données', () => {
    const { service, repository } = withCategories('riz')
    service.addTransaction(expense(100))
    const firstId = service.getSnapshot().activeWalletId
    service.createWallet('Banque')
    expect(activeWallet(service.getSnapshot()).name).toBe('Banque')
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(0)
    service.switchWallet(firstId)
    expect(activeWallet(service.getSnapshot()).transactions).toHaveLength(1)
    service.renameWallet(firstId, 'Caisse')
    expect(repository.saved!.wallets.map((w) => w.name)).toEqual(['Caisse', 'Banque'])
    expect(() => service.createWallet('banque')).toThrow('existe déjà')
    service.removeWallet(firstId)
    expect(service.getSnapshot().wallets).toHaveLength(1)
    expect(() => service.removeWallet(service.getSnapshot().activeWalletId)).toThrow('dernier')
  })
})

describe('sauvegarde JSON', () => {
  it('exporter : fichier nommé avec la date, contenu relisible', () => {
    const { service, files } = withCategories('riz')
    service.addTransaction(expense(500))
    expect(service.exportBackup()).toBe('repere-sauvegarde-2026-10-01.json')
    const [download] = files.downloads
    expect(download!.fileName).toBe('repere-sauvegarde-2026-10-01.json')
    expect(service.previewImport('x.json', download!.content).wallets).toEqual([{ name: 'Principal', transactions: 1, categories: 1 }])
  })

  it('importer en remplaçant', async () => {
    const source = withCategories('riz')
    source.service.addTransaction(expense(500))
    source.service.exportBackup()
    const target = createTestService()
    target.files.next = { name: 'sauvegarde.json', text: source.files.downloads[0]!.content }
    const preview = await target.service.chooseImportFile()
    expect(preview?.fileName).toBe('sauvegarde.json')
    expect(activeWallet(target.service.getSnapshot()).transactions).toHaveLength(0)   // la prévisualisation ne modifie rien
    target.service.applyImport(preview!, 'replace')
    expect(activeWallet(target.service.getSnapshot()).transactions).toHaveLength(1)
    expect(activeWallet(target.repository.saved!).transactions).toHaveLength(1)
  })

  it('importer en fusionnant : les portefeuilles existants sont conservés, les noms en double renommés', async () => {
    const source = withCategories('riz')
    source.service.exportBackup()
    const target = withCategories('bazar')
    target.files.next = { name: 'a.json', text: source.files.downloads[0]!.content }
    target.service.applyImport((await target.service.chooseImportFile())!, 'merge')
    expect(target.service.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Principal (2)'])
    expect(activeWallet(target.service.getSnapshot()).categories.map((c) => c.name)).toEqual(['bazar'])
  })

  it('un fichier invalide est refusé sans rien modifier ; annuler retourne null', async () => {
    const { service, files, repository } = withCategories('riz')
    const before = service.getSnapshot()
    files.next = { name: 'mauvais.json', text: '{"format":"repere","version":1,"wallets":[{"name":"X","transactions":[{"date":"2026-13-01"}]}]}' }
    await expect(service.chooseImportFile()).rejects.toThrow(DomainError)
    expect(service.getSnapshot()).toBe(before)
    files.next = null
    expect(await service.chooseImportFile()).toBeNull()
    expect(repository.saved).toBe(before)
  })

  it('tout effacer repart d\'un espace vide', () => {
    const { service } = withCategories('riz')
    service.resetAll()
    expect(activeWallet(service.getSnapshot()).categories).toEqual([])
  })
})

describe('plusieurs onglets', () => {
  it('une modification faite ailleurs est rechargée et notifiée', () => {
    const a = withCategories('riz')
    const b = createTestService()
    b.service.setInitialBalance(1)   // état différent
    const listener = vi.fn()
    a.service.subscribe(listener)
    a.repository.externalChange(b.service.getSnapshot())
    expect(listener).toHaveBeenCalledTimes(1)
    expect(activeWallet(a.service.getSnapshot()).initialBalance).toBe(1)
  })
})
