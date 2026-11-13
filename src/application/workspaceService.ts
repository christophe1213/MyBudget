/**
 * Cas d'usage de l'application : chaque commande applique une règle PURE du domaine, enregistre via le port
 * `WorkspaceRepository`, puis prévient les abonnés (l'interface). Si la règle ou l'enregistrement échoue, l'état
 * précédent est conservé.
 */
import type { IsoDate } from '@/domain/dates'
import * as ledger from '@/domain/ledger'
import type { Wallet, Workspace } from '@/domain/model'
import { type Period } from '@/domain/period'
import { depositLabel } from '@/domain/services/budget'
import * as ws from '@/domain/workspace'
import { parseWorkspace, serializeWorkspace } from './backup'
import type { BackupFiles, Clock, IdGenerator, WorkspaceRepository } from './ports'

export type ImportMode = 'replace' | 'merge'

export interface ImportPreview {
  fileName: string
  workspace: Workspace
  wallets: { name: string; transactions: number; categories: number }[]
}

export interface Dependencies {
  repository: WorkspaceRepository
  clock: Clock
  ids: IdGenerator
  files: BackupFiles
}

export class WorkspaceService {
  private state: Workspace
  private readonly listeners = new Set<() => void>()
  private startupWarning: string | undefined

  constructor(private readonly deps: Dependencies) {
    this.state = ws.createWorkspace(deps.ids.next())
  }

  /** Charge les données enregistrées (ou crée un espace vide au premier lancement). */
  start(): string | undefined {
    const { workspace, warning } = this.deps.repository.load()
    if (workspace) this.state = workspace
    else this.deps.repository.save(this.state)
    this.startupWarning = warning
    this.deps.repository.subscribeExternalChanges?.(() => {
      const reloaded = this.deps.repository.load().workspace
      if (reloaded) this.replaceState(reloaded)
    })
    return warning
  }

  get warning(): string | undefined {
    return this.startupWarning
  }

  setStartupWarning(message: string): void {
    this.startupWarning = message
  }

  // ---- observation (utilisée par React via useSyncExternalStore) -------------------------------
  getSnapshot = (): Workspace => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private replaceState(next: Workspace): void {
    this.state = next
    this.listeners.forEach((l) => l())
  }

  /** Enregistre d'abord, adopte ensuite : un échec d'écriture laisse l'état intact. */
  private commit(next: Workspace): void {
    if (next === this.state) return
    this.deps.repository.save(next)
    this.replaceState(next)
  }

  private change(rule: (w: Wallet) => Wallet): void {
    this.commit(ws.updateActive(this.state, rule))
  }

  today(): IsoDate {
    return this.deps.clock.today()
  }

  // ---- transactions -----------------------------------------------------------------------------
  addTransaction(input: ledger.NewTransaction): void {
    const id = this.deps.ids.next()
    this.change((w) => ledger.addTransaction(w, input, id))
  }

  deleteTransactions(ids: readonly string[]): void {
    this.change((w) => ledger.removeTransactions(w, ids))
  }

  setInitialBalance(amount: number): void {
    this.change((w) => ledger.setInitialBalance(w, amount))
  }

  // ---- catégories ---------------------------------------------------------------------------------
  addCategory(name: string): void {
    this.change((w) => ledger.addCategory(w, name))
  }

  renameCategory(oldName: string, newName: string): void {
    this.change((w) => ledger.renameCategory(w, oldName, newName))
  }

  removeCategory(name: string): void {
    this.change((w) => ledger.removeCategory(w, name))
  }

  setDailyBudget(category: string, amount: number): void {
    this.change((w) => ledger.setDailyBudget(w, category, amount))
  }

  setCategoryInitialBalance(category: string, amount: number): void {
    this.change((w) => ledger.setCategoryInitialBalance(w, category, amount))
  }

  /** Crée un dépôt par (catégorie, montant > 0), daté du premier jour de la période. */
  createDeposits(period: Period, lines: readonly (readonly [string, number])[]): number {
    const before = ws.activeWallet(this.state).transactions.length
    this.change((w) => ledger.addDeposits(w, lines, period.start, depositLabel(period), () => this.deps.ids.next()))
    return ws.activeWallet(this.state).transactions.length - before
  }

  // ---- portefeuilles ---------------------------------------------------------------------------------
  createWallet(name: string): void {
    this.commit(ws.addWallet(this.state, this.deps.ids.next(), name))
  }

  renameWallet(id: string, name: string): void {
    this.commit(ws.renameWallet(this.state, id, name))
  }

  removeWallet(id: string): void {
    this.commit(ws.removeWallet(this.state, id))
  }

  switchWallet(id: string): void {
    this.commit(ws.activateWallet(this.state, id))
  }

  // ---- sauvegarde JSON ------------------------------------------------------------------------------------
  /** Télécharge toutes les données dans un fichier JSON ; retourne son nom. */
  exportBackup(): string {
    const fileName = `repere-sauvegarde-${this.today()}.json`
    this.deps.files.download(fileName, serializeWorkspace(this.state, this.deps.clock.nowIso()))
    return fileName
  }

  /** Demande un fichier et le vérifie SANS rien modifier ; null si l'utilisateur annule. */
  async chooseImportFile(): Promise<ImportPreview | null> {
    const picked = await this.deps.files.pickText()
  
    console.log('picked', picked)
    return picked ? this.previewImport(picked.name, picked.text) : null
  }

  previewImport(fileName: string, text: string): ImportPreview {
         
    const workspace = parseWorkspace(text, () => this.deps.ids.next())

    return {
      fileName, workspace,
      wallets: workspace.wallets.map((w) => ({ name: w.name, transactions: w.transactions.length, categories: w.categories.length })),
    }
  }

  applyImport(preview: ImportPreview, mode: ImportMode): void {
    this.commit(mode === 'replace' ? preview.workspace : ws.mergeWorkspaces(this.state, preview.workspace, () => this.deps.ids.next()))
  }

  /** Efface tout et repart d'un espace vide. */
  resetAll(): void {
    this.commit(ws.createWorkspace(this.deps.ids.next()))
  }
}
