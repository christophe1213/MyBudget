import { SyncError } from '@/application/ports'
import { activeWallet } from '@/domain/workspace'
import { createTestService } from '@/test/fakes'
import type { Received } from './syncSession'

const ADDRESS = 'http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA'

async function setup() {
  const ctx = createTestService('2026-10-14')
  ctx.service.addCategory('riz')
  ctx.service.addTransaction({ date: '2026-10-14', category: 'riz', kind: 'deposit', label: '', amount: 5000 })
  const session = await ctx.service.openSync(ADDRESS)
  const received: Received[] = []
  session.onReceived((r) => received.push(r))
  return { ...ctx, session, connection: ctx.sync.connections[0]!, received }
}

const backup = (over: object = {}) => ({
  type: 'workspace',
  data: { format: 'repere', version: 1, wallets: [{ id: 'srv', name: 'Serveur', initialBalance: 0, categories: [{ name: 'bazar', dailyBudget: 0 }], transactions: [{ id: 't', date: '2026-10-01', category: 'bazar', kind: 'expense', label: '', amount: 700 }] }], ...over },
})

describe('synchronisation avec un serveur distant', () => {
  it("ouvre la connexion sur l'adresse WebSocket déduite de l'adresse donnée", async () => {
    const { sync, session } = await setup()
    expect(sync.urls).toEqual(['ws://192.168.1.20:8000/ws?token=zLhJ-QcsSdyX2bOC3o6SjA'])
    expect(session.label).toBe('192.168.1.20:8000')
    expect(session.isOpen).toBe(true)
  })

  it("adresse invalide : aucune connexion n'est tentée", async () => {
    const { service, sync } = createTestService()
    await expect(service.openSync('http://192.168.1.20:8000/')).rejects.toThrow(/token/)
    expect(sync.urls).toEqual([])
  })

  it('serveur injoignable ou session refusée : le message de la passerelle est transmis', async () => {
    const { service, sync } = createTestService()
    sync.failWith = new SyncError('Session refusée : le QR code a peut-être expiré.')
    await expect(service.openSync(ADDRESS)).rejects.toThrow('Session refusée')
  })

  it("envoie tous les portefeuilles au format « repere » et dit ce qui est parti", async () => {
    const { session, connection } = await setup()
    expect(session.send()).toEqual({ wallets: 1, transactions: 1 })
    const message = connection.sent[0]!
    expect(message.type).toBe('workspace')
    expect(message.data).toMatchObject({ format: 'repere', version: 1, exportedAt: '2026-10-14T09:00:00.000Z' })
    expect(JSON.stringify(message.data)).toContain('"amount":5000')
  })

  it('demande ses données au serveur', async () => {
    const { session, connection } = await setup()
    session.requestWorkspace()
    expect(connection.sent).toEqual([{ type: 'get_workspace' }])
  })

  it("les données reçues deviennent un aperçu : rien n'est modifié tant que l'utilisateur n'a pas choisi", async () => {
    const { service, connection, received } = await setup()
    const before = service.getSnapshot()
    connection.receive(backup())
    expect(received).toHaveLength(1)
    const only = received[0]!
    if (!('preview' in only)) throw new Error('aperçu attendu')
    expect(only.preview.wallets).toEqual([{ name: 'Serveur', transactions: 1, categories: 1 }])
    expect(service.getSnapshot()).toBe(before)
    service.applyImport(only.preview, 'merge')
    expect(service.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Serveur'])
    expect(activeWallet(service.getSnapshot()).name).toBe('Principal')
  })

  it('données reçues invalides : erreur signalée, état intact', async () => {
    const { service, connection, received } = await setup()
    const before = service.getSnapshot()
    connection.receive(backup({ wallets: [{ id: 'a', name: 'X', transactions: [{ date: '2026-02-30', category: 'c', kind: 'expense', amount: 1 }] }] }))
    connection.receive({ type: 'workspace', data: 'pas une sauvegarde' })
    expect(received).toHaveLength(2)
    expect(received.every((r) => 'error' in r)).toBe(true)
    expect((received[0] as { error: string }).error).toMatch(/date invalide/)
    expect(service.getSnapshot()).toBe(before)
  })

  it('les autres types de message sont ignorés', async () => {
    const { connection, received } = await setup()
    connection.receive({ type: 'status', data: { connected: true } })
    expect(received).toEqual([])
  })

  it('coupure côté serveur : prévient, puis refuse d\u2019envoyer', async () => {
    const { session, connection } = await setup()
    const closed: string[] = []
    session.onClosed((reason) => closed.push(reason))
    connection.drop('Le serveur a fermé la connexion.')
    expect(closed).toEqual(['Le serveur a fermé la connexion.'])
    expect(session.isOpen).toBe(false)
    expect(() => session.send()).toThrow(SyncError)
    expect(() => session.requestWorkspace()).toThrow(SyncError)
  })

  it("fermée par l'appareil : fermeture de la connexion, sans prévenir de coupure", async () => {
    const { session, connection } = await setup()
    const closed: string[] = []
    session.onClosed((reason) => closed.push(reason))
    session.close()
    session.close()
    expect(connection.closed).toBe(true)
    expect(closed).toEqual([])
  })

  it('sans passerelle (stockage seul) : la synchronisation est indisponible', async () => {
    const { WorkspaceService } = await import('./workspaceService')
    const { InMemoryRepository, FakeFiles, FixedClock, SequenceIds } = await import('@/test/fakes')
    const service = new WorkspaceService({ repository: new InMemoryRepository(), clock: new FixedClock(), ids: new SequenceIds(), files: new FakeFiles() })
    await expect(service.openSync(ADDRESS)).rejects.toThrow(/pas disponible/)
  })
})
