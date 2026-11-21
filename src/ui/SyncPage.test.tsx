/** Parcours de synchronisation dans la vraie interface, avec un serveur simulé. */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncError } from '@/application/ports'
import { createTestService } from '@/test/fakes'
import { App } from './App'

const ADDRESS = 'http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA'
const SOCKET = 'ws://192.168.1.20:8000/ws?token=zLhJ-QcsSdyX2bOC3o6SjA'

const serverBackup = {
  type: 'workspace',
  data: { format: 'repere', version: 1, wallets: [{ id: 'srv', name: 'Caisse serveur', initialBalance: 0, categories: [{ name: 'bazar', dailyBudget: 0 }], transactions: [{ id: 't', date: '2026-10-01', category: 'bazar', kind: 'expense', label: 'tomates', amount: 700 }] }] },
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

  it("envoie les données après confirmation ; annuler n'envoie rien", async () => {
    const { user, sync } = await openSyncPage()
    await connectByAddress(user)
    const connection = sync.connections[0]!

    await user.click(screen.getByRole('button', { name: 'Envoyer mes données' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Envoyer vos données ?' })).getByRole('button', { name: 'Annuler' }))
    expect(connection.sent).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Envoyer mes données' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Envoyer vos données ?' })).getByRole('button', { name: 'Envoyer' }))
    expect(connection.sent).toHaveLength(1)
    expect(connection.sent[0]).toMatchObject({ type: 'workspace', data: { format: 'repere', version: 1 } })
    expect(await screen.findByText(/Envoyé : 1 portefeuille\(s\), 0 transaction\(s\)/)).toBeInTheDocument()
  })

  it("récupère les données : demande, aperçu, puis ajout seulement après accord", async () => {
    const { user, sync, service } = await openSyncPage()
    await connectByAddress(user)
    const connection = sync.connections[0]!

    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    expect(connection.sent).toEqual([{ type: 'get_workspace' }])
    expect(screen.getByRole('button', { name: 'En attente du serveur…' })).toBeDisabled()

    connection.receive(serverBackup)
    const sheet = await screen.findByRole('dialog', { name: 'Importer une sauvegarde' })
    expect(within(sheet).getByText('Caisse serveur')).toBeInTheDocument()
    expect(service.getSnapshot().wallets).toHaveLength(1)

    await user.click(within(sheet).getByRole('button', { name: 'Ajouter ces portefeuilles' }))
    expect(service.getSnapshot().wallets.map((w) => w.name)).toEqual(['Principal', 'Caisse serveur'])
    expect(screen.getByRole('button', { name: 'Récupérer les données' })).toBeEnabled()
  })

  it('données reçues invalides : message, aucun aperçu', async () => {
    const { user, sync, service } = await openSyncPage()
    await connectByAddress(user)
    await user.click(screen.getByRole('button', { name: 'Récupérer les données' }))
    sync.connections[0]!.receive({ type: 'workspace', data: { format: 'autre' } })
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
