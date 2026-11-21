import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { StorageError, SyncError } from '@/application/ports'
import type { WorkspaceService } from '@/application/workspaceService'
import { DomainError } from '@/domain/errors'
import type { Wallet, Workspace } from '@/domain/model'
import { activeWallet } from '@/domain/workspace'
import { useToast } from './feedback'

// ---- accès aux données --------------------------------------------------------------------------
const ServiceContext = createContext<WorkspaceService | null>(null)

export function ServiceProvider({ service, children }: { service: WorkspaceService; children: ReactNode }) {
  return <ServiceContext.Provider value={service}>{children}</ServiceContext.Provider>
}

export function useService(): WorkspaceService {
  const service = useContext(ServiceContext)
  if (!service) throw new Error('ServiceProvider manquant')
  return service
}

/** Se met à jour à chaque modification des données (y compris depuis un autre onglet). */
export function useWorkspace(): Workspace {
  const service = useService()
  return useSyncExternalStore(service.subscribe, service.getSnapshot)
}

export function useWallet(): Wallet {
  return activeWallet(useWorkspace())
}

// ---- exécution d'une commande avec retour à l'utilisateur ------------------------------------------
export function messageOf(error: unknown): string {
  if (error instanceof DomainError || error instanceof StorageError || error instanceof SyncError) return error.message
  console.error(error)
  return 'Une erreur inattendue est survenue.'
}

/** `run(commande, message)` : exécute, affiche le message de succès ou l'erreur, retourne true si tout s'est bien passé. */
export function useRun(): (action: () => unknown, success?: string) => boolean {
  const toast = useToast()
  return useCallback((action, success) => {
    try {
      action()
      if (success) toast.success(success)
      return true
    } catch (e) {
      toast.error(messageOf(e))
      return false
    }
  }, [toast])
}

// ---- navigation entre les pages -----------------------------------------------------------------------
export type TabId = 'dashboard' | 'entry' | 'budgets' | 'report' | 'settings' | 'sync'
export type BudgetsSection = 'categories' | 'plan' | 'analysis'

interface Navigation {
  tab: TabId
  budgetsSection: BudgetsSection
  go(tab: TabId, budgetsSection?: BudgetsSection): void
  setBudgetsSection(section: BudgetsSection): void
}

const NavigationContext = createContext<Navigation | null>(null)

export function NavigationProvider({ children, initial = 'dashboard' }: { children: ReactNode; initial?: TabId }) {
  const [tab, setTab] = useState<TabId>(initial)
  const [budgetsSection, setBudgetsSection] = useState<BudgetsSection>('categories')
  const value = useMemo<Navigation>(() => ({
    tab, budgetsSection, setBudgetsSection,
    go: (next, section) => { setTab(next); if (section) setBudgetsSection(section); window.scrollTo?.({ top: 0 }) },
  }), [tab, budgetsSection])
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function useNavigation(): Navigation {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('NavigationProvider manquant')
  return value
}
