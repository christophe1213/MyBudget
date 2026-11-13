/** Ensemble des portefeuilles et portefeuille actif (fonctions pures). */
import { DomainError } from './errors'
import { emptyWallet } from './ledger'
import type { Wallet, Workspace } from './model'

export function createWorkspace(walletId: string, walletName = 'Principal'): Workspace {
  return { activeWalletId: walletId, wallets: [emptyWallet(walletId, walletName)] }
}

export function activeWallet(ws: Workspace): Wallet {
  return ws.wallets.find((w) => w.id === ws.activeWalletId) ?? ws.wallets[0]!
}

const sameName = (a: string, b: string): boolean => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr')

function checkName(ws: Workspace, raw: string, ignoreId?: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new DomainError('Le nom ne peut pas être vide.')
  if (ws.wallets.some((w) => w.id !== ignoreId && sameName(w.name, name))) throw new DomainError(`Un portefeuille « ${name} » existe déjà.`)
  return name
}

/** Applique une modification au portefeuille actif. */
export function updateActive(ws: Workspace, change: (w: Wallet) => Wallet): Workspace {
  const current = activeWallet(ws)
  const updated = change(current)
  return updated === current ? ws : { ...ws, wallets: ws.wallets.map((w) => (w.id === current.id ? updated : w)) }
}

export function addWallet(ws: Workspace, id: string, rawName: string): Workspace {
  const name = checkName(ws, rawName)
  return { activeWalletId: id, wallets: [...ws.wallets, emptyWallet(id, name)] }
}

export function renameWallet(ws: Workspace, id: string, rawName: string): Workspace {
  if (!ws.wallets.some((w) => w.id === id)) throw new DomainError('Portefeuille introuvable.')
  const name = checkName(ws, rawName, id)
  return { ...ws, wallets: ws.wallets.map((w) => (w.id === id ? { ...w, name } : w)) }
}

export function removeWallet(ws: Workspace, id: string): Workspace {
  if (ws.wallets.length === 1) throw new DomainError('Impossible de supprimer le dernier portefeuille.')
  if (!ws.wallets.some((w) => w.id === id)) throw new DomainError('Portefeuille introuvable.')
  const wallets = ws.wallets.filter((w) => w.id !== id)
  return { activeWalletId: ws.activeWalletId === id ? wallets[0]!.id : ws.activeWalletId, wallets }
}

export function activateWallet(ws: Workspace, id: string): Workspace {
  if (!ws.wallets.some((w) => w.id === id)) throw new DomainError('Portefeuille introuvable.')
  return { ...ws, activeWalletId: id }
}

/** Ajoute les portefeuilles de `incoming` à `base` ; les identifiants et les noms déjà pris sont modifiés. */
export function mergeWorkspaces(base: Workspace, incoming: Workspace, newId: () => string): Workspace {
  const wallets = [...base.wallets]
  for (const wallet of incoming.wallets) {
    const id = wallets.some((w) => w.id === wallet.id) ? newId() : wallet.id
    let name = wallet.name
    for (let n = 2; wallets.some((w) => sameName(w.name, name)); n += 1) name = `${wallet.name} (${n})`
    wallets.push({ ...wallet, id, name })
  }
  return { activeWalletId: base.activeWalletId, wallets }
}
