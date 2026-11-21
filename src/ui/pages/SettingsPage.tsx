import { useState } from 'react'
import type { ImportMode, ImportPreview } from '@/application/workspaceService'
import { totalBalance } from '@/domain/services/balances'
import { DownloadIcon, SyncIcon, UploadIcon } from '@/ui/components/icons'
import { Sheet } from '@/ui/components/Sheet'
import { AmountInput, Button, Card, CardTitle, Field, Notice, PageTitle, Segmented, TextInput } from '@/ui/components/ui'
import { messageOf, useNavigation, useRun, useService, useWallet, useWorkspace } from '@/ui/context'
import { useConfirm, useToast } from '@/ui/feedback'
import { formatAr, formatNumber, parseAmountOrZero } from '@/ui/format'

export function SettingsPage() {
  const wallet = useWallet()
  return (
    <div className="space-y-4">
      <PageTitle title="Réglages" subtitle="Portefeuilles, sauvegarde et données" />
      <InitialBalanceCard key={wallet.id} />
      <WalletsCard />
      <DataCard />
    </div>
  )
}

function InitialBalanceCard() {
  const wallet = useWallet()
  const service = useService()
  const run = useRun()
  const [text, setText] = useState(wallet.initialBalance ? formatNumber(wallet.initialBalance) : '')
  const [error, setError] = useState<string | null>(null)
  const save = (e: React.FormEvent): void => {
    e.preventDefault()
    const value = parseAmountOrZero(text)
    if (value === null) { setError('Entrez un montant entier.'); return }
    setError(null)
    run(() => service.setInitialBalance(value), 'Solde initial enregistré')
  }
  return (
    <Card aria-label="Solde initial">
      <CardTitle>Solde initial de « {wallet.name} »</CardTitle>
      <form onSubmit={save} className="space-y-3">
        <Field label="Montant (Ar)" error={error} hint="Ce que vous aviez avant la première transaction, hors catégories. Le solde de départ de chaque catégorie (Budgets → Catégories) s'y ajoute.">
          {(id) => <AmountInput id={id} value={text} onChange={setText} placeholder="0" />}
        </Field>
        <Button type="submit" variant="secondary" full>Enregistrer</Button>
      </form>
    </Card>
  )
}

function WalletsCard() {
  const workspace = useWorkspace()
  const service = useService()
  const run = useRun()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <Card aria-label="Portefeuilles">
      <CardTitle aside={<Button small onClick={() => setAdding(true)}>+ Nouveau</Button>}>Portefeuilles</CardTitle>
      <ul className="-mx-1 divide-y divide-line">
        {workspace.wallets.map((w) => (
          <li key={w.id} className="flex items-center gap-2 py-1">
            <button type="button" onClick={() => setEditing(w.id)} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left active:bg-surface" aria-label={`Gérer le portefeuille ${w.name}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{w.name}</span>
                <span className="block text-xs text-muted">{w.transactions.length} transaction(s) · {formatAr(totalBalance(w))}</span>
              </span>
            </button>
            {w.id === workspace.activeWalletId
              ? <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Ouvert</span>
              : <Button small variant="secondary" onClick={() => run(() => service.switchWallet(w.id), `Portefeuille « ${w.name} » ouvert`)}>Ouvrir</Button>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Chaque portefeuille (banque, caisse…) a ses propres catégories, budgets et transactions.</p>
      {adding && <NewWalletSheet onClose={() => setAdding(false)} />}
      {editing && <WalletSheet key={editing} id={editing} onClose={() => setEditing(null)} />}
    </Card>
  )
}

function NewWalletSheet({ onClose }: { onClose: () => void }) {
  const service = useService()
  const run = useRun()
  const [name, setName] = useState('')
  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (run(() => service.createWallet(name), 'Portefeuille créé')) onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Nouveau portefeuille" footer={<Button type="submit" form="new-wallet" full>Créer</Button>}>
      <form id="new-wallet" onSubmit={submit}>
        <Field label="Nom" hint="Il devient le portefeuille ouvert.">{(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Banque, Caisse" autoFocus autoComplete="off" />}</Field>
      </form>
    </Sheet>
  )
}

function WalletSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const workspace = useWorkspace()
  const service = useService()
  const run = useRun()
  const confirm = useConfirm()
  const wallet = workspace.wallets.find((w) => w.id === id)
  const [name, setName] = useState(wallet?.name ?? '')
  if (!wallet) return null
  const only = workspace.wallets.length === 1

  const rename = (e: React.FormEvent): void => {
    e.preventDefault()
    if (run(() => service.renameWallet(id, name), 'Portefeuille renommé')) onClose()
  }
  const remove = async (): Promise<void> => {
    const ok = await confirm({
      title: `Supprimer « ${wallet.name} » ?`,
      message: `Ses ${wallet.transactions.length} transaction(s) et ses catégories seront effacées. Pensez à exporter une sauvegarde avant.`,
      confirmLabel: 'Supprimer', danger: true,
    })
    if (ok && run(() => service.removeWallet(id), 'Portefeuille supprimé')) onClose()
  }

  return (
    <Sheet open onClose={onClose} title={wallet.name}
      footer={(
        <>
          <Button type="submit" form="rename-wallet" full>Renommer</Button>
          <Button variant="danger" full disabled={only} onClick={remove}>Supprimer le portefeuille</Button>
          {only && <p className="text-center text-xs text-muted">Il faut garder au moins un portefeuille.</p>}
        </>
      )}>
      <form id="rename-wallet" onSubmit={rename}>
        <Field label="Nom">{(fieldId) => <TextInput id={fieldId} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}</Field>
      </form>
    </Sheet>
  )
}

function DataCard() {
  const service = useService()
  const { go } = useNavigation()
  const run = useRun()
  const toast = useToast()
  const confirm = useConfirm()
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const exportBackup = (): void => {
    let fileName = ''
    if (run(() => { fileName = service.exportBackup() })) toast.success(`Sauvegarde téléchargée : ${fileName}`)
  }

  const chooseFile = async (): Promise<void> => {
    try {
      setPreview(await service.chooseImportFile())
    } catch (e) {
      toast.error(messageOf(e))
    }
  }

  const reset = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Tout effacer ?',
      message: 'Tous les portefeuilles, catégories et transactions de cet appareil seront supprimés. Cette action est définitive : exportez d\u2019abord une sauvegarde.',
      confirmLabel: 'Tout effacer', danger: true,
    })
    if (ok) run(() => service.resetAll(), 'Toutes les données ont été effacées')
  }

  return (
    <Card aria-label="Données">
      <CardTitle>Données</CardTitle>
      <div className="space-y-3">
        <Notice tone="info">Vos données restent <strong>sur cet appareil</strong> (stockage du navigateur). Exportez-les régulièrement en JSON pour en garder une copie ou les ouvrir sur un autre appareil.</Notice>
        <Button full onClick={exportBackup}><DownloadIcon className="size-5" />Exporter (JSON)</Button>
        <Button full variant="secondary" onClick={chooseFile}><UploadIcon className="size-5" />Importer (JSON)</Button>
        <Button full variant="secondary" onClick={() => go('sync')}><SyncIcon className="size-5" />Synchroniser avec un serveur</Button>
        <Button full variant="danger" onClick={reset}>Tout effacer</Button>
      </div>
      {preview && <ImportSheet preview={preview} onClose={() => setPreview(null)} />}
    </Card>
  )
}

/** `fromServer` : données reçues d'un serveur distant (étape de validation avant enregistrement, puis message de réussite détaillé). */
export function ImportSheet({ preview, onClose, fromServer = false }: { preview: ImportPreview; onClose: () => void; fromServer?: boolean }) {
  const service = useService()
  const run = useRun()
  const [mode, setMode] = useState<ImportMode>('merge')
  const total = preview.wallets.reduce((s, w) => s + w.transactions, 0)
  const apply = (): void => {
    const done = fromServer
      ? `Opération réussie : ${mode === 'replace' ? 'données remplacées' : 'portefeuilles ajoutés'} (${preview.wallets.length} portefeuille(s), ${total} transaction(s) enregistrés sur cet appareil)`
      : mode === 'replace' ? 'Données remplacées' : 'Portefeuilles ajoutés'
    if (run(() => service.applyImport(preview, mode), done)) onClose()
  }
  return (
    <Sheet open onClose={onClose} title={fromServer ? 'Valider les données reçues' : 'Importer une sauvegarde'}
      footer={(
        <>
          <Button full variant={mode === 'replace' ? 'danger' : 'primary'} onClick={apply}>{mode === 'replace' ? 'Remplacer mes données' : 'Ajouter ces portefeuilles'}</Button>
          <Button full variant="ghost" onClick={onClose}>Annuler</Button>
        </>
      )}>
      {fromServer
        ? <Notice tone="success">Validation réussie : les données reçues de « {preview.fileName} » sont conformes ({preview.wallets.length} portefeuille(s), {total} transaction(s)). Rien n'est enregistré avant votre accord.</Notice>
        : <p className="text-sm text-muted">Fichier « {preview.fileName} » : {preview.wallets.length} portefeuille(s), {total} transaction(s). Il est valide.</p>}
      <ul className="divide-y divide-line rounded-xl border border-line">
        {preview.wallets.map((w) => (
          <li key={w.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="truncate font-semibold">{w.name}</span>
            <span className="shrink-0 text-xs text-muted">{w.transactions} transaction(s) · {w.categories} catégorie(s)</span>
          </li>
        ))}
      </ul>
      <Segmented label="Mode d'import" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Ajouter' }, { value: 'replace', label: 'Remplacer' }]} />
      {mode === 'merge'
        ? <Notice tone="info">Vos portefeuilles actuels sont conservés. Si un nom existe déjà, il est suivi de « (2) ».</Notice>
        : <Notice tone="warn">Toutes vos données actuelles seront remplacées par celles du fichier.</Notice>}
    </Sheet>
  )
}
