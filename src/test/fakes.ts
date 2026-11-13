/** Faux adaptateurs pour les tests : l'application tourne sans navigateur, sans stockage, sans fichier. */
import type { BackupFiles, Clock, IdGenerator, LoadResult, WorkspaceRepository } from '@/application/ports'
import { StorageError } from '@/application/ports'
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

export function createTestService(day = '2026-10-01') {
  const repository = new InMemoryRepository()
  const files = new FakeFiles()
  const service = new WorkspaceService({ repository, clock: new FixedClock(day), ids: new SequenceIds(), files })
  service.start()
  return { service, repository, files }
}
