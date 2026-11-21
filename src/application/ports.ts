/**
 * PORTS SORTANTS : ce dont l'application a besoin du monde extérieur.
 * L'application les définit ; les adaptateurs (src/adapters) les implémentent.
 */
import type { IsoDate } from '@/domain/dates'
import type { Workspace } from '@/domain/model'

/** Le stockage n'a pas pu lire ou écrire (espace plein, stockage désactivé...). */
export class StorageError extends Error {
  constructor(message: string, readonly kind: 'quota' | 'unavailable' = 'unavailable') {
    super(message)
    this.name = 'StorageError'
  }
}

export interface LoadResult {
  /** null : rien n'est encore enregistré (premier lancement) ou les données étaient illisibles. */
  workspace: Workspace | null
  /** Message à montrer à l'utilisateur (ex. données illisibles mises de côté). */
  warning?: string
}

export interface WorkspaceRepository {
  load(): LoadResult
  /** Lève StorageError si l'écriture échoue : l'état précédent doit alors rester intact. */
  save(workspace: Workspace): void
  /** Prévient quand un autre onglet modifie les données ; retourne la fonction qui annule l'abonnement. */
  subscribeExternalChanges?(callback: () => void): () => void
}

/** La connexion au serveur distant a échoué ou s'est interrompue (message prêt à afficher). */
export class SyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncError'
  }
}

/**
 * Message échangé avec le serveur (même protocole que test_synchronisation.html) :
 *   { "type": "data", "payload": <sauvegarde repere> }   données (envoi, ou réponse à une demande)
 *   { "type": "request", "start"?: "AAAA-MM-JJ" }         demande des données de l'autre côté
 *   { "type": "ack", "message"?: "..." }                  accusé de réception du serveur
 *   { "type": "error", "message": "..." }                 refus ou erreur
 */
export interface SyncMessage {
  readonly type: string
  readonly payload?: unknown
  readonly start?: string
  readonly message?: string
}

export interface SyncConnection {
  /** Lève SyncError si la connexion est fermée. */
  send(message: SyncMessage): void
  onMessage(listener: (message: SyncMessage) => void): void
  /** `reason` : message prêt à afficher à l'utilisateur. */
  onClose(listener: (reason: string) => void): void
  close(): void
}

export interface SyncGateway {
  /** Ouvre la connexion ; rejette avec une SyncError si le serveur est injoignable ou refuse la session. */
  connect(socketUrl: string): Promise<SyncConnection>
}

export interface Clock {
  today(): IsoDate
  nowIso(): string
}

export interface IdGenerator {
  next(): string
}

/** Échange de fichiers de sauvegarde avec l'utilisateur. */
export interface BackupFiles {
  download(fileName: string, content: string): void
  /** Demande un fichier à l'utilisateur ; null s'il annule. */
  pickText(): Promise<{ name: string; text: string } | null>
}
