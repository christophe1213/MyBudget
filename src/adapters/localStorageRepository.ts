/** Stockage des données dans le localStorage du navigateur (un seul enregistrement JSON). */
import { parseWorkspace, serializeWorkspace } from '@/application/backup'
import { StorageError, type LoadResult, type WorkspaceRepository } from '@/application/ports'
import type { Workspace } from '@/domain/model'

export const STORAGE_KEY = 'repere.workspace.v1'

const isQuotaError = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22)

export class LocalStorageRepository implements WorkspaceRepository {
  constructor(
    private readonly storage: Storage,
    private readonly newId: () => string,
    private readonly events: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = typeof window === 'undefined' ? null : window,
  ) {}

  load(): LoadResult {
    let raw: string | null
    try {
      raw = this.storage.getItem(STORAGE_KEY)
    } catch {
      throw new StorageError("Le stockage du navigateur est inaccessible (navigation privée ou cookies bloqués ?).")
    }
    if (raw === null) return { workspace: null }
    try {
      return { workspace: parseWorkspace(raw, this.newId) }
    } catch {
      // Jamais d'écrasement silencieux : les données illisibles sont recopiées avant de repartir de zéro.
      const copyKey = `${STORAGE_KEY}.illisible-${Date.now()}`
      try { this.storage.setItem(copyKey, raw) } catch { /* espace plein : tant pis pour la copie */ }
      return { workspace: null, warning: `Les données enregistrées étaient illisibles. Une copie a été conservée sous « ${copyKey} » dans le stockage du navigateur ; l'application repart d'un espace vide (vous pouvez aussi importer une sauvegarde).` }
    }
  }

  save(workspace: Workspace): void {
    try {
      this.storage.setItem(STORAGE_KEY, serializeWorkspace(workspace))
    } catch (e) {
      if (isQuotaError(e)) throw new StorageError("Espace de stockage plein : exportez vos données puis supprimez d'anciennes transactions.", 'quota')
      throw new StorageError("Impossible d'enregistrer les données dans le navigateur.")
    }
  }

  subscribeExternalChanges(callback: () => void): () => void {
    const events = this.events
    if (!events) return () => undefined
    const handler = (e: Event): void => {
      const key = (e as StorageEvent).key
      if (key === null || key === STORAGE_KEY) callback()   // key === null : le stockage entier a été vidé
    }
    events.addEventListener('storage', handler)
    return () => events.removeEventListener('storage', handler)
  }
}
