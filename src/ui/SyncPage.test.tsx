/** Parcours de synchronisation dans la vraie interface, avec un serveur simulé. */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncError } from '@/application/ports'
import { createTestService } from '@/test/fakes'
import { App } from './App'

const ADDRESS = 'http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA'
const SOCKET = 'ws://192.168.1.20:8000/ws?token=zLhJ-QcsSdyX2bOC3o6SjA'

const serverBackup = {
  type: 'data',
  payload: { format: 'repere', version: 1, wallets: [{ id: 'srv', name: 'Caisse serveur', initialBalance: 0, categories: [{ name: 'bazar', dailyBudget: 0 }], transactions: [{ id: 't', date: '2026-10-01', category: 'bazar', kind: 'expense', label: 'tomates', amount: 700 }] }] },
}

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    start(_camera: unknown, _config: unknown, onDecoded: (text: string) => void): Promise<void> {
      onDecoded('http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA')
      return Promise.resolve()
    }
    stop(): Promise<void> { return Promise.resolve() }
    clear(): void { /* rien */ }
  },
}))

async function openSyncPage() {
  const ctx = createTestService('2026-10-14')
  ctx.service.addCategory('riz')
  const user = userEvent.setup()
  render(<App service={ctx.service} initialTab="settings" />)
  await user.click(screen.getByRole('button', { name: 'Synchroniser avec un serveur' }))
  return { ...ctx, user }
}

async function connectByAddress(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Adresse du serveur'), ADDRESS)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
  await screen.findByText(/Connecté à/)
}

describe('écran de synchronisation', () => {
  it("s'ouvre depuis les Réglages, sans ajouter d'onglet à la barre du bas", async () => {
    const { user } = await openSyncPage()
    expect(screen.getByRole('heading', { name: 'Synchronisation' })).toBeInTheDocument()
    const bar = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(bar).getAllByRole('button')).toHaveLength(5)
    expect(within(bar).getByRole('button', { name: 'Réglages' })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: '← Réglages' }))
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument()
  })

  it("se connecte par l'adresse saisie", async () => {
    const { user, sync } = await openSyncPage()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeDisabled()
    await connectByAddress(user)
    expect(sync.urls).toEqual([SOCKET])
    expect(screen.getByText('192.168.1.20:8000')).toBeInTheDocument()
  })

  describe('QR code', () => {
    const secure = (value: boolean) => Object.defineProperty(window, 'isSecureContext', { value, configurable: true })   // jsdom ne le définit pas
    afterEach(() => { Reflect.deleteProperty(window, 'isSecureContext') })

    it('se connecte en scannant le QR code', async () => {
      secure(true)
      const { user, sync } = await openSyncPage()
      await user.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
      await screen.findByText(/Connecté à/)
      expect(sync.urls).toEqual([SOCKET])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it("page non sécurisée : la caméra est refusée, on explique comment saisir l'adresse", async () => {
      secure(false)
      const { user, sync } = await openSyncPage()
      await user.click(screen.getByRole('button', { name: 'Scanner le QR code' }))
      expect(await screen.findByText(/qu'en HTTPS/)).toBeInTheDocument()
      await user.click(within(screen.getByRole('dialog', { name: 'Scanner le QR code' })).getByRole('button', { name: 'Annuler' }))
      expect(sync.urls).toEqual([])
      expect(screen.getByLabelText('Adresse du serveur')).toBeInTheDocument()
    })
  })

  it('adresse invalide ou serveur injoignable : un message, et on reste sur le formulaire', async () => {
    const { user, sync } = await openSyncPage()
    await user.type(screen.getByLabelText('Adresse du serveur'), 'http://192.168.1.20:8000/')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText(/paramètre « token » est absent/)).toBeInTheDocument()
    expect(sync.urls).toEqual([])

    sync.failWith = new SyncError('Le serveur ne répond pas.')
    await user.clear(screen.getByLabelText('Adresse du serveur'))
    await user.type(screen.getByLabelText('Adresse du serveur'), ADDRESS)
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText('Le serveur ne répond pas.')).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse du serveur')).toBeInTheDocument()
  })

  it("envoie les données après validation et confirmation ; annuler n'envoie rien", async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    const connection = sync.connections[0]!

    await user.click(screen.getByRole('button', { name: 'Envoyer mes données' }))
    const dialog = screen.getByRole('dialog', { name: 'Valider l’envoi ?' })
    expect(within(dialog).getByText(/Vérification réussie : 1 portefeuille\(s\) \(Principal\), 0 transaction\(s\)/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    expect(connection.sent).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Envoyer mes données' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Valider l’envoi ?' })).getByRole('button', { name: 'Envoyer' }))
    expect(connection.sent).toHaveLength(1)
    expect(connection.sent[0]).toMatchObject({ type: 'data', payload: { format: 'repere', version: 1 } })
    expect(await screen.findByText(/Opération réussie : 1 portefeuille\(s\), 0 transaction\(s\) envoyés au serveur/)).toBeInTheDocument()

    connection.receive({ type: 'ack', message: 'reçu' })
    expect(await screen.findByText(/le serveur a confirmé la réception \(reçu\)/)).toBeInTheDocument()
  })

  it("le serveur demande les données : validation puis réponse, ou refus signalé", async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    const connection = sync.connections[0]!

    connection.receive({ type: 'request' })
    const dialog = await screen.findByRole('dialog', { name: 'Le serveur demande vos données' })
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(connection.sent).toEqual([{ type: 'error', message: "Envoi refusé sur l'appareil." }]))

    connection.receive({ type: 'request' })
    await user.click(within(await screen.findByRole('dialog', { name: 'Le serveur demande vos données' })).getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(connection.sent).toHaveLength(2))
    expect(connection.sent[1]).toMatchObject({ type: 'data', payload: { format: 'repere' } })
    expect(await screen.findByText(/Opération réussie : 1 portefeuille\(s\)/)).toBeInTheDocument()
  })

  it("récupère les données : demande, validation, puis enregistrement seulement après accord", async () => {
    const { user, sync, service, repository } = await openSyncPage()
    await connectByAddress(user)
    const connection = sync.connections[0]!

    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    expect(connection.sent).toEqual([{ type: 'request' }])
    expect(screen.getByRole('button', { name: 'En attente du serveur…' })).toBeDisabled()

    const savesBefore = repository.saves
    connection.receive(serverBackup)
    const sheet = await screen.findByRole('dialog', { name: 'Valider les données reçues' })
    expect(within(sheet).getByText(/Validation réussie/)).toBeInTheDocument()
    expect(within(sheet).getByText('Caisse serveur')).toBeInTheDocument()
    expect(service.getSnapshot().wallets).toHaveLength(1)
    expect(repository.saves).toBe(savesBefore)   // rien n'est enregistré avant l'accord

    await user.click(within(sheet).getByRole('button', { name: 'Ajouter ces portefeuilles' }))
    expect(service.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Caisse serveur'])
    expect(repository.saves).toBe(savesBefore + 1)
    expect(await screen.findByText(/Opération réussie : portefeuilles ajoutés \(1 portefeuille\(s\), 1 transaction\(s\) enregistrés/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Récupérer les données' })).toBeEnabled()
  })

  it('récupère à partir d\u2019une date', async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    await user.type(screen.getByLabelText('Récupérer à partir du (facultatif)'), '2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    expect(sync.connections[0]!.sent).toEqual([{ type: 'request', start: '2026-09-01' }])
  })

  it('erreur signalée par le serveur : message, aucun aperçu', async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    sync.connections[0]!.receive({ type: 'error', message: 'portefeuille inconnu' })
    expect(await screen.findByText(/Le serveur signale une erreur : portefeuille inconnu/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('données reçues invalides : message, aucun aperçu', async () => {
    const { user, sync, service } = await openSyncPage()
    await connectByAddress(user)
    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    sync.connections[0]!.receive({ type: 'data', payload: { format: 'autre' } })
    expect(await screen.findByText(/Données reçues refusées/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(service.getSnapshot().wallets).toHaveLength(1)
  })

  it('coupure du serveur : retour au formulaire avec un message', async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    sync.connections[0]!.drop('Le serveur a fermé la connexion.')
    expect(await screen.findByText('Le serveur a fermé la connexion.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Adresse du serveur')).toBeInTheDocument())
  })

  it('« Se déconnecter » ferme la connexion ; quitter la page aussi', async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(sync.connections[0]!.closed).toBe(true)
    expect(screen.getByLabelText('Adresse du serveur')).toBeInTheDocument()

    await connectByAddress(user)
    await user.click(screen.getByRole('button', { name: '← Réglages' }))
    expect(sync.connections[1]!.closed).toBe(true)
  })
})
