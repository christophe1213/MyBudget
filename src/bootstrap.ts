/**
 * RACINE DE COMPOSITION : le seul endroit (avec main.tsx) qui connaît les adaptateurs concrets.
 *
 *   interface React ──► WorkspaceService (cas d'usage) ──► ports ◄── adaptateurs (localStorage, fichiers, horloge)
 *
 * Changer de stockage (IndexedDB, API distante...) = écrire un autre `WorkspaceRepository` et le brancher ici.
 */
import { StorageError, type WorkspaceRepository } from '@/application/ports'
import { WorkspaceService } from '@/application/workspaceService'
import { BrowserBackupFiles } from '@/adapters/browserFiles'
import { LocalStorageRepository } from '@/adapters/localStorageRepository'
import { MemoryRepository } from '@/adapters/memoryRepository'
import { SystemClock, UuidGenerator } from '@/adapters/system'

export function createWorkspaceService(): WorkspaceService {
  const ids = new UuidGenerator()
  const build = (repository: WorkspaceRepository): WorkspaceService =>
    new WorkspaceService({ repository, clock: new SystemClock(), ids, files: new BrowserBackupFiles() })

  try {
    const service = build(new LocalStorageRepository(window.localStorage, () => ids.next()))
    service.start()
    return service
  } catch (e) {
    if (!(e instanceof StorageError)) throw e
    const fallback = build(new MemoryRepository())   // l'application reste utilisable, sans conservation des données
    fallback.start()
    fallback.setStartupWarning(`${e.message} Les données ne seront PAS conservées : pensez à exporter une sauvegarde.`)
    return fallback
  }
}
