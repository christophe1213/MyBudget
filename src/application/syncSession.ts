/**
 * Session ouverte avec un serveur distant. Messages JSON { type, data } :
 *
 *   appareil → serveur   { "type": "workspace", "data": <sauvegarde « repere », voir backup.ts> }   envoi des données
 *                        { "type": "get_workspace" }                                              demande des données du serveur
 *   serveur → appareil   { "type": "workspace", "data": <sauvegarde « repere »> }                 réponse à la demande, ou envoi spontané
 *
 * Les données reçues ne sont JAMAIS appliquées d'office : elles deviennent un aperçu validé que l'utilisateur
 * choisit d'ajouter ou de remplacer (même chemin que l'import d'un fichier).
 */
import { DomainError } from '@/domain/errors'
import type { Workspace } from '@/domain/model'
import { serializeWorkspace } from './backup'
import { SyncError, type SyncConnection, type SyncMessage } from './ports'
import type { ImportPreview } from './workspaceService'

export type Received = { readonly preview: ImportPreview } | { readonly error: string }

export interface SyncOperations {
  snapshot(): Workspace
  nowIso(): string
  preview(fileName: string, text: string): ImportPreview
}

export class SyncSession {
  private open = true
  private readonly receivers = new Set<(received: Received) => void>()
  private readonly closers = new Set<(reason: string) => void>()

  constructor(readonly label: string, private readonly connection: SyncConnection, private readonly ops: SyncOperations) {
    connection.onMessage((message) => this.handle(message))
    connection.onClose((reason) => {
      if (!this.open) return   // fermée par nous : rien à signaler
      this.open = false
      this.closers.forEach((listener) => listener(reason))
    })
  }

  get isOpen(): boolean {
    return this.open
  }

  /** Envoie tous les portefeuilles au serveur ; retourne ce qui est parti. */
  send(): { wallets: number; transactions: number } {
    const workspace = this.ops.snapshot()
    this.transmit({ type: 'workspace', data: JSON.parse(serializeWorkspace(workspace, this.ops.nowIso())) })
    return { wallets: workspace.wallets.length, transactions: workspace.wallets.reduce((sum, w) => sum + w.transactions.length, 0) }
  }

  /** Demande ses données au serveur ; la réponse arrive par `onReceived`. */
  requestWorkspace(): void {
    this.transmit({ type: 'get_workspace' })
  }

  onReceived(listener: (received: Received) => void): () => void {
    this.receivers.add(listener)
    return () => this.receivers.delete(listener)
  }

  onClosed(listener: (reason: string) => void): () => void {
    this.closers.add(listener)
    return () => this.closers.delete(listener)
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.connection.close()
  }

  private transmit(message: SyncMessage): void {
    if (!this.open) throw new SyncError('La connexion est fermée : reconnectez-vous.')
    this.connection.send(message)
  }

  private handle(message: SyncMessage): void {
    if (message.type !== 'workspace') return
    let received: Received
    try {
      received = { preview: this.ops.preview('Serveur distant', JSON.stringify(message.data)) }
    } catch (e) {
      received = { error: e instanceof DomainError ? `Données reçues refusées. ${e.message}` : 'Les données reçues sont illisibles.' }
    }
    this.receivers.forEach((listener) => listener(received))
  }
}
