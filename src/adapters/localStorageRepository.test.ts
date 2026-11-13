import { StorageError } from '@/application/ports'
import { addCategory, emptyWallet } from '@/domain/ledger'
import { LocalStorageRepository, STORAGE_KEY } from './localStorageRepository'

const ids = () => { let n = 0; return () => `gen${++n}` }
const workspace = () => ({ activeWalletId: 'w1', wallets: [addCategory(emptyWallet('w1', 'Principal'), 'riz')] })

beforeEach(() => localStorage.clear())

describe('LocalStorageRepository', () => {
  it('premier lancement : rien d\'enregistré', () => {
    expect(new LocalStorageRepository(localStorage, ids()).load()).toEqual({ workspace: null })
  })

  it('aller-retour, et le contenu enregistré est le JSON de sauvegarde lisible', () => {
    const repo = new LocalStorageRepository(localStorage, ids())
    repo.save(workspace())
    expect(repo.load().workspace).toEqual(workspace())
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ format: 'repere', version: 1 })
  })

  it('données illisibles : jamais écrasées en silence, une copie est gardée et l\'utilisateur est prévenu', () => {
    localStorage.setItem(STORAGE_KEY, '{ceci est cassé')
    const result = new LocalStorageRepository(localStorage, ids()).load()
    expect(result.workspace).toBeNull()
    expect(result.warning).toMatch(/illisibles/)
    const copies = Object.keys(localStorage).filter((k) => k.startsWith(`${STORAGE_KEY}.illisible-`))
    expect(copies).toHaveLength(1)
    expect(localStorage.getItem(copies[0]!)).toBe('{ceci est cassé')
  })

  it('espace plein : StorageError de type quota', () => {
    const full = { getItem: () => null, setItem: () => { throw new DOMException('plein', 'QuotaExceededError') } } as unknown as Storage
    expect(() => new LocalStorageRepository(full, ids()).save(workspace())).toThrow(expect.objectContaining({ kind: 'quota' }))
  })

  it('stockage inaccessible (navigation privée) : StorageError à la lecture', () => {
    const blocked = { getItem: () => { throw new DOMException('bloqué', 'SecurityError') } } as unknown as Storage
    expect(() => new LocalStorageRepository(blocked, ids()).load()).toThrow(StorageError)
  })

  it('prévient quand un autre onglet modifie les données, ignore les autres clés, se désabonne', () => {
    const repo = new LocalStorageRepository(localStorage, ids())
    const callback = vi.fn()
    const unsubscribe = repo.subscribeExternalChanges(callback)
    window.dispatchEvent(new StorageEvent('storage', { key: 'autre-cle' }))
    expect(callback).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: null }))   // stockage vidé
    expect(callback).toHaveBeenCalledTimes(2)
    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    expect(callback).toHaveBeenCalledTimes(2)
  })
})
