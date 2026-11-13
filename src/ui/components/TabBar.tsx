import type { ReactNode } from 'react'
import type { TabId } from '@/ui/context'
import { HomeIcon, PieIcon, PlusIcon, ReportIcon, SettingsIcon } from './icons'

const TABS: readonly { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Accueil', icon: <HomeIcon /> },
  { id: 'entry', label: 'Saisie', icon: <PlusIcon /> },
  { id: 'budgets', label: 'Budgets', icon: <PieIcon /> },
  { id: 'report', label: 'Rapport', icon: <ReportIcon /> },
  { id: 'settings', label: 'Réglages', icon: <SettingsIcon /> },
]

/** Navigation du bas : accessible au pouce, respecte la zone de sécurité (encoche, barre de geste). */
export function TabBar({ current, onChange }: { current: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <button type="button" onClick={() => onChange(tab.id)} aria-current={tab.id === current ? 'page' : undefined}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${tab.id === current ? 'text-brand-700' : 'text-muted'}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${tab.id === current ? 'bg-brand-50' : ''}`}>{tab.icon}</span>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
