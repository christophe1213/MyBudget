import { type LoadResult, type WorkspaceRepository } from '@/application/ports'
import type { Workspace } from '@/domain/model'

/** Données conservées seulement le temps de la session : secours si le stockage du navigateur est inaccessible. */
export class MemoryRepository implements WorkspaceRepository {
  private saved: Workspace | null = null

  load(): LoadResult {
    return { workspace: this.saved }
  }

  save(workspace: Workspace): void {
    this.saved = workspace
  }
}
