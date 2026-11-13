import { useState } from 'react'
import type { WorkspaceService } from '@/application/workspaceService'
import { ChevronIcon, WalletIcon } from './components/icons'
import { Sheet } from './components/Sheet'
import { TabBar } from './components/TabBar'
import { Button, Notice } from './components/ui'
import { NavigationProvider, ServiceProvider, useNavigation, useRun, useService, useWorkspace, type TabId } from './context'
import { FeedbackProvider } from './feedback'
import { formatAr } from './format'
import { BudgetsPage } from './pages/BudgetsPage'
import { DashboardPage } from './pages/DashboardPage'
import { EntryPage } from './pages/EntryPage'
import { ReportPage } from './pages/ReportPage'
import { SettingsPage } from './pages/SettingsPage'
import { totalBalance } from '@/domain/services/balances'

const PAGES: Record<TabId, () => React.JSX.Element> = {
  dashboard: DashboardPage, entry: EntryPage, budgets: BudgetsPage, report: ReportPage, settings: SettingsPage,
}

export function App({ service, initialTab }: { service: WorkspaceService; initialTab?: TabId }) {
  return (
    <ServiceProvider service={service}>
      <FeedbackProvider>
        <NavigationProvider initial={initialTab}>
          <Shell />
        </NavigationProvider>
      </FeedbackProvider>
    </ServiceProvider>
  )
}

function Shell() {
  const { tab, go } = useNavigation()
  const service = useService()
  const [warning, setWarning] = useState(service.warning)
  const Page = PAGES[tab]
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <TopBar />
      {warning && (
        <div className="px-4 pb-2">
          <Notice tone="warn" action={<Button small variant="ghost" onClick={() => setWarning(undefined)}>Compris</Button>}>{warning}</Notice>
        </div>
      )}
      <main className="flex-1 px-4 pb-28 pt-1"><Page /></main>
      <TabBar current={tab} onChange={go} />
    </div>
  )
}

/** Marque + portefeuille ouvert (un toucher pour en changer). */
function TopBar() {
  const workspace = useWorkspace()
  const service = useService()
  const run = useRun()
  const { go } = useNavigation()
  const [open, setOpen] = useState(false)
  const active = workspace.wallets.find((w) => w.id === workspace.activeWalletId) ?? workspace.wallets[0]!

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-surface/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-700">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-sm text-white" aria-hidden>R</span>Repère
      </p>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Portefeuille ouvert : ${active.name}. Changer de portefeuille`}
        className="flex min-h-10 max-w-[60%] items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-semibold active:bg-brand-50">
        <WalletIcon className="size-4 shrink-0 text-brand-600" /><span className="truncate">{active.name}</span><ChevronIcon className="size-4 shrink-0 text-muted" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Changer de portefeuille"
        footer={<Button full variant="secondary" onClick={() => { setOpen(false); go('settings') }}>Gérer les portefeuilles</Button>}>
        <ul className="divide-y divide-line">
          {workspace.wallets.map((w) => (
            <li key={w.id}>
              <button type="button" aria-current={w.id === active.id ? 'true' : undefined}
                onClick={() => { if (w.id === active.id || run(() => service.switchWallet(w.id))) setOpen(false) }}
                className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                <span className={`size-2.5 shrink-0 rounded-full ${w.id === active.id ? 'bg-brand-600' : 'bg-line'}`} aria-hidden />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{w.name}</span><span className="block text-xs text-muted">{formatAr(totalBalance(w))}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </header>
  )
}
