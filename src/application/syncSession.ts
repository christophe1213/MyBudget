/**
 * Session ouverte avec un serveur distant. Messages JSON (même protocole que test_synchronisation.html) :
 *
 *   appareil → serveur   { "type": "data", "payload": <sauvegarde « repere », voir backup.ts> }   envoi des données
 *                        { "type": "request", "start"?: "AAAA-MM-JJ" }                            demande des données du serveur
 *                        { "type": "error", "message": "..." }                                    refus de répondre à une demande
 *   serveur → appareil   { "type": "data", "payload": <sauvegarde « repere »> }                   réponse à la demande, ou envoi spontané
 *                        { "type": "request" }                                                    le serveur demande les données de l'appareil
 *                        { "type": "ack", "message"?: "..." }                                     accusé de réception d'un envoi
 *                        { "type": "error", "message": "..." }                                    erreur signalée par le serveur
 *
 * Étape de validation : rien ne part sans que les données de l'appareil aient été vérifiées (`prepareSend`), et rien
 * de ce qui arrive n'est appliqué d'office : les données reçues deviennent un aperçu déjà validé, que l'utilisateur
 * choisit d'ajouter ou de remplacer (même chemin que l'import d'un fichier) avant tout enregistrement.
 */
import { isIsoDate } from '@/domain/dates'
import { DomainError } from '@/domain/errors'
import type { Workspace } from '@/domain/model'
import { serializeWorkspace } from './backup'
import { SyncError, type SyncConnection, type SyncMessage } from './ports'
import type { ImportPreview } from './workspaceService'

export type Received = { readonly preview: ImportPreview } | { readonly error: string }

/** Données de l'appareil, vérifiées et prêtes à partir. */
export interface PreparedSend {
  readonly wallets: number
  readonly transactions: number
  readonly names: readonly string[]
}

export interface SyncOperations {
  snapshot(): Workspace
  nowIso(): string
  preview(fileName: string, text: string): ImportPreview
}

const SERVER = 'Serveur distant'

export class SyncSession {
  private open = true
  private readonly receivers = new Set<(received: Received) => void>()
  private readonly closers = new Set<(reason: string) => void>()
  private readonly acknowledgers = new Set<(message: string) => void>()
  private readonly requesters = new Set<() => void>()

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

  /** Vérifie les données de l'appareil comme le ferait le destinataire ; lève une DomainError si elles sont incohérentes. Ne modifie rien et n'envoie rien. */
  prepareSend(): PreparedSend {
    const text = serializeWorkspace(this.ops.snapshot(), this.ops.nowIso())
    let checked: ImportPreview
    try {
      checked = this.ops.preview('Cet appareil', text)
    } catch (e) {
      throw new DomainError(`Vérification échouée, rien n'a été envoyé. ${e instanceof DomainError ? e.message : 'Les données de cet appareil sont illisibles.'}`)
    }
    return {
      wallets: checked.wallets.length,
      transactions: checked.wallets.reduce((sum, w) => sum + w.transactions, 0),
      names: checked.wallets.map((w) => w.name),
    }
  }

  /** Vérifie, puis envoie tous les portefeuilles au serveur ; retourne ce qui est parti. */
  send(): PreparedSend {
    const prepared = this.prepareSend()
    this.transmit({ type: 'data', payload: JSON.parse(serializeWorkspace(this.ops.snapshot(), this.ops.nowIso())) })
    return prepared
  }

  /** Demande ses données au serveur (à partir de `start` si donné) ; la réponse arrive par `onReceived`. */
  requestWorkspace(start?: string): void {
    if (start !== undefined && !isIsoDate(start)) throw new DomainError('Date invalide : AAAA-MM-JJ attendu.')
    this.transmit(start ? { type: 'request', start } : { type: 'request' })
  }

  /** Réponse à une demande du serveur (`onRequested`) : envoie les données vérifiées, ou signale le refus. */
  answerRequest(accepted: boolean): PreparedSend | null {
    if (!accepted) {
      this.transmit({ type: 'error', message: "Envoi refusé sur l'appareil." })
      return null
    }
    return this.send()
  }

  onReceived(listener: (received: Received) => void): () => void {
    this.receivers.add(listener)
    return () => this.receivers.delete(listener)
  }

  /** Le serveur confirme avoir bien reçu un envoi. */
  onAcknowledged(listener: (message: string) => void): () => void {
    this.acknowledgers.add(listener)
    return () => this.acknowledgers.delete(listener)
  }

  /** Le serveur demande les données de l'appareil : l'utilisateur doit valider avant de répondre (`answerRequest`). */
  onRequested(listener: () => void): () => void {
    this.requesters.add(listener)
    return () => this.requesters.delete(listener)
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
    switch (message.type) {
      case 'data': {
        if (!message.payload) return
        this.receive(() => this.ops.preview(SERVER, JSON.stringify(message.payload)))
        return
      }
      case 'ack':
        this.acknowledgers.forEach((listener) => listener(message.message || 'reçu'))
        return
      case 'error':
        this.receivers.forEach((listener) => listener({ error: `Le serveur signale une erreur : ${message.message || 'erreur'}` }))
        return
      case 'request':
        this.requesters.forEach((listener) => listener())
        return
      default:
        return   // autres types : ignorés
    }
  }

  private receive(read: () => ImportPreview): void {
    let received: Received
    try {
      received = { preview: read() }
    } catch (e) {
      received = { error: e instanceof DomainError ? `Données reçues refusées. ${e.message}` : 'Les données reçues sont illisibles.' }
    }
    this.receivers.forEach((listener) => listener(received))
  }
}
