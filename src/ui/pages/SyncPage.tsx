/** Synchronisation avec un serveur distant : connexion par QR code ou par adresse, puis envoi / récupération des données. */
import { useEffect, useRef, useState } from 'react'
import type { SyncSession } from '@/application/syncSession'
import type { ImportPreview } from '@/application/workspaceService'
import { DownloadIcon, QrIcon, UploadIcon } from '@/ui/components/icons'
import { Sheet } from '@/ui/components/Sheet'
import { Button, Card, CardTitle, Field, Notice, PageTitle, TextInput } from '@/ui/components/ui'
import { messageOf, useNavigation, useRun, useService, useWorkspace } from '@/ui/context'
import { useConfirm, useToast } from '@/ui/feedback'
import { ImportSheet } from './SettingsPage'

const READER_ID = 'qr-reader'
const ANSWER_TIMEOUT_MS = 10_000

export function SyncPage() {
  const service = useService()
  const workspace = useWorkspace()
  const run = useRun()
  const toast = useToast()
  const confirm = useConfirm()
  const { go } = useNavigation()
  const [session, setSession] = useState<SyncSession | null>(null)
  const [address, setAddress] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Écoute la session ouverte ; la ferme quand on la quitte ou qu'on quitte la page.
  useEffect(() => {
    if (!session) return
    const offReceived = session.onReceived((received) => {
      setWaiting(false)
      if ('preview' in received) setPreview(received.preview)
      else toast.error(received.error)
    })
    const offClosed = session.onClosed((reason) => {
      setSession(null)
      setWaiting(false)
      toast.error(reason)
    })
    return () => { offReceived(); offClosed(); session.close() }
  }, [session, toast])

  useEffect(() => {
    if (!waiting) return
    const timer = setTimeout(() => { setWaiting(false); toast.error('Le serveur n\u2019a pas répondu.') }, ANSWER_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [waiting, toast])

  const connect = async (value: string): Promise<void> => {
    setConnecting(true)
    try {
      const opened = await service.openSync(value)
      if (mounted.current) setSession(opened)
      else opened.close()
    } catch (e) {
      toast.error(messageOf(e))
    } finally {
      if (mounted.current) setConnecting(false)
    }
  }

  const send = async (): Promise<void> => {
    if (!session) return
    const wallets = workspace.wallets.length
    const ok = await confirm({
      title: 'Envoyer vos données ?',
      message: `Les ${wallets} portefeuille(s) de cet appareil seront envoyés à ${session.label}.`,
      confirmLabel: 'Envoyer',
    })
    if (!ok) return
    let sent = { wallets: 0, transactions: 0 }
    if (run(() => { sent = session.send() })) toast.success(`Envoyé : ${sent.wallets} portefeuille(s), ${sent.transactions} transaction(s)`)
  }

  const request = (): void => {
    if (session && run(() => session.requestWorkspace())) setWaiting(true)
  }

  const disconnect = (): void => {
    session?.close()
    setSession(null)
    setWaiting(false)
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void connect(address)
  }

  const scanned = (text: string): void => {
    setScanning(false)
    setAddress(text)
    void connect(text)
  }

  return (
    <div className="space-y-4">
      <div>
        <Button small variant="ghost" onClick={() => go('settings')}>← Réglages</Button>
        <PageTitle title="Synchronisation" subtitle="Envoyer ou récupérer vos données avec un serveur distant" />
      </div>

      {session ? (
        <Card aria-label="Serveur connecté">
          <CardTitle>Connecté</CardTitle>
          <div className="space-y-3">
            <Notice tone="success">Connecté à <strong>{session.label}</strong>.</Notice>
            <Button full onClick={send}><UploadIcon className="size-5" />Envoyer mes données</Button>
            <Button full variant="secondary" disabled={waiting} onClick={request}><DownloadIcon className="size-5" />{waiting ? 'En attente du serveur…' : 'Récupérer les données'}</Button>
            <Button full variant="ghost" onClick={disconnect}>Se déconnecter</Button>
            <p className="text-xs text-muted">Les données reçues ne sont appliquées qu'après votre accord : vous choisirez d'<strong>ajouter</strong> les portefeuilles ou de <strong>remplacer</strong> vos données.</p>
          </div>
        </Card>
      ) : (
        <Card aria-label="Connexion">
          <CardTitle>Se connecter au serveur</CardTitle>
          <div className="space-y-3">
            <Notice tone="info">Le serveur affiche un <strong>QR code</strong> et une <strong>adresse</strong>. Les deux appareils doivent être sur le même réseau.</Notice>
            <Button full disabled={connecting} onClick={() => setScanning(true)}><QrIcon className="size-5" />Scanner le QR code</Button>
            <p className="text-center text-xs text-muted">ou</p>
            <form onSubmit={submit} className="space-y-3">
              <Field label="Adresse du serveur" hint="Recopiez l'adresse affichée sous le QR code.">
                {(id) => <TextInput id={id} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="http://192.168.1.20:8000/?token=…"
                  inputMode="url" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />}
              </Field>
              <Button type="submit" variant="secondary" full disabled={connecting || !address.trim()}>{connecting ? 'Connexion…' : 'Se connecter'}</Button>
            </form>
          </div>
        </Card>
      )}

      {scanning && <QrScannerSheet onScan={scanned} onClose={() => setScanning(false)} />}
      {preview && <ImportSheet preview={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/** Lecture du QR code par la caméra. La bibliothèque n'est chargée qu'à l'ouverture de cette feuille. */
function QrScannerSheet({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const latest = useRef(onScan)
  latest.current = onScan

  useEffect(() => {
    if (!window.isSecureContext) {
      setError("La caméra n'est accessible qu'en HTTPS (ou sur localhost). Saisissez l'adresse du serveur à la place.")
      return
    }
    let done = false
    let scanner: { stop(): Promise<unknown>; clear(): void } | null = null
    const started = import('html5-qrcode')
      .then(async ({ Html5Qrcode }) => {
        const instance = new Html5Qrcode(READER_ID)
        scanner = instance
        await instance.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 240 },
          (text) => { if (!done) { done = true; latest.current(text) } },
          () => undefined,   // erreurs de lecture image par image : ignorées
        )
      })
      .catch(() => setError("Impossible d'utiliser la caméra : autorisez-la dans le navigateur, ou saisissez l'adresse du serveur."))
    return () => {
      done = true
      void started.then(() => scanner?.stop()).then(() => scanner?.clear()).catch(() => undefined)
    }
  }, [])

  return (
    <Sheet open onClose={onClose} title="Scanner le QR code" footer={<Button full variant="ghost" onClick={onClose}>Annuler</Button>}>
      {error ? <Notice tone="warn">{error}</Notice> : <p className="text-sm text-muted">Cadrez le QR code affiché par le serveur.</p>}
      <div id={READER_ID} className="overflow-hidden rounded-xl" />
    </Sheet>
  )
}
