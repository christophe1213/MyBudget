/** Faux adaptateurs pour les tests : l'application tourne sans navigateur, sans stockage, sans fichier. */
import type { BackupFiles, Clock, IdGenerator, LoadResult, SyncConnection, SyncGateway, SyncMessage, WorkspaceRepository } from '@/application/ports'
import { StorageError, SyncError } from '@/application/ports'
import { WorkspaceService } from '@/application/workspaceService'
import type { IsoDate } from '@/domain/dates'
import type { Workspace } from '@/domain/model'

export class SequenceIds implements IdGenerator {
  private n = 0
  next(): string {
    this.n += 1
    return `id${this.n}`
  }
}

export class FixedClock implements Clock {
  constructor(private day: IsoDate = '2026-10-01') {}
  today(): IsoDate { return this.day }
  nowIso(): string { return `${this.day}T09:00:00.000Z` }
}

export class InMemoryRepository implements WorkspaceRepository {
  saved: Workspace | null = null
  saves = 0
  failWith: StorageError | null = null
  warning: string | undefined
  private listeners = new Set<() => void>()

  load(): LoadResult { return { workspace: this.saved, warning: this.warning } }

  save(workspace: Workspace): void {
    if (this.failWith) throw this.failWith
    this.saved = workspace
    this.saves += 1
  }

  subscribeExternalChanges(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /** Simule la modification des données par un autre onglet. */
  externalChange(workspace: Workspace): void {
    this.saved = workspace
    this.listeners.forEach((l) => l())
  }
}

export class FakeFiles implements BackupFiles {
  downloads: { fileName: string; content: string }[] = []
  next: { name: string; text: string } | null = null
  download(fileName: string, content: string): void { this.downloads.push({ fileName, content }) }
  async pickText(): Promise<{ name: string; text: string } | null> { return this.next }
}

export class FakeConnection implements SyncConnection {
  sent: SyncMessage[] = []
  closed = false
  private readonly messageListeners: ((message: SyncMessage) => void)[] = []
  private readonly closeListeners: ((reason: string) => void)[] = []

  send(message: SyncMessage): void {
    if (this.closed) throw new SyncError('La connexion est fermée : reconnectez-vous.')
    this.sent.push(message)
  }
  onMessage(listener: (message: SyncMessage) => void): void { this.messageListeners.push(listener) }
  onClose(listener: (reason: string) => void): void { this.closeListeners.push(listener) }
  close(): void { this.closed = true; this.closeListeners.forEach((l) => l('fermée par l\u2019appareil')) }

  /** Simule un message venu du serveur. */
  receive(message: SyncMessage): void { this.messageListeners.forEach((l) => l(message)) }
  /** Simule une coupure côté serveur. */
  drop(reason = 'La connexion avec le serveur est terminée.'): void { this.closed = true; this.closeListeners.forEach((l) => l(reason)) }
}

export class FakeSyncGateway implements SyncGateway {
  urls: string[] = []
  connections: FakeConnection[] = []
  failWith: SyncError | null = null

  async connect(socketUrl: string): Promise<SyncConnection> {
    this.urls.push(socketUrl)
    if (this.failWith) throw this.failWith
    const connection = new FakeConnection()
    this.connections.push(connection)
    return connection
  }
}

export function createTestService(day = '2026-10-01') {
  const repository = new InMemoryRepository()
  const files = new FakeFiles()
  const sync = new FakeSyncGateway()
  const service = new WorkspaceService({ repository, clock: new FixedClock(day), ids: new SequenceIds(), files, sync })
  service.start()
  return { service, repository, files, sync }
}
