/** Synchronisation avec un serveur distant : connexion par QR code ou par adresse, puis envoi / récupération des données. */
import { useEffect, useRef, useState } from 'react'
import type { PreparedSend, SyncSession } from '@/application/syncSession'
import type { ImportPreview } from '@/application/workspaceService'
import { DownloadIcon, QrIcon, UploadIcon } from '@/ui/components/icons'
import { Sheet } from '@/ui/components/Sheet'
import { Button, Card, CardTitle, DateInput, Field, Notice, PageTitle, TextInput } from '@/ui/components/ui'
import { messageOf, useNavigation, useRun, useService } from '@/ui/context'
import { useConfirm, useToast } from '@/ui/feedback'
import { ImportSheet } from './SettingsPage'

const READER_ID = 'qr-reader'
const ANSWER_TIMEOUT_MS = 10_000

export function SyncPage() {
  const service = useService()
  const run = useRun()
  const toast = useToast()
  const confirm = useConfirm()
  const { go } = useNavigation()
  const [session, setSession] = useState<SyncSession | null>(null)
  const [address, setAddress] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [start, setStart] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const mounted = useRef(true)
  const serverAsked = useRef<() => void>(() => undefined)   // toujours la version à jour de la réponse à une demande du serveur

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
    const offAcknowledged = session.onAcknowledged((message) => toast.success(`Opération réussie : le serveur a confirmé la réception (${message}).`))
    const offRequested = session.onRequested(() => serverAsked.current())
    const offClosed = session.onClosed((reason) => {
      setSession(null)
      setWaiting(false)
      toast.error(reason)
    })
    return () => { offReceived(); offAcknowledged(); offRequested(); offClosed(); session.close() }
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

  /** Exécute une commande ; en cas d'échec, affiche le message et retourne null. */
  const attempt = <T,>(action: () => T): { value: T } | null => {
    try {
      return { value: action() }
    } catch (e) {
      toast.error(messageOf(e))
      return null
    }
  }

  const sentMessage = (sent: PreparedSend): string =>
    `Opération réussie : ${sent.wallets} portefeuille(s), ${sent.transactions} transaction(s) envoyés au serveur`

  /** Étape de validation : les données de l'appareil sont vérifiées, puis l'utilisateur confirme, avant tout envoi. */
  const validateThenSend = async (title: string, intro: string): Promise<void> => {
    if (!session) return
    const checked = attempt(() => session.prepareSend())
    if (!checked) return
    const { wallets, names, transactions } = checked.value
    const ok = await confirm({
      title,
      message: `${intro} Vérification réussie : ${wallets} portefeuille(s) (${names.join(', ')}), ${transactions} transaction(s) seront envoyés à ${session.label}.`,
      confirmLabel: 'Envoyer',
    })
    if (!ok) return
    const sent = attempt(() => session.send())
    if (sent) toast.success(sentMessage(sent.value))
  }

  const send = (): Promise<void> => validateThenSend('Valider l\u2019envoi ?', 'Les données de cet appareil vont être envoyées.')

  // Le serveur demande les données de l'appareil : même validation ; un refus (ou des données invalides) lui est signalé.
  serverAsked.current = () => {
    void (async () => {
      if (!session) return
      const checked = attempt(() => session.prepareSend())
      const { wallets, names, transactions } = checked?.value ?? { wallets: 0, names: [], transactions: 0 }
      const ok = checked !== null && await confirm({
        title: 'Le serveur demande vos données',
        message: `Le serveur ${session.label} demande les données de cet appareil. Vérification réussie : ${wallets} portefeuille(s) (${names.join(', ')}), ${transactions} transaction(s) seraient envoyés.`,
        confirmLabel: 'Envoyer',
      })
      const answered = attempt(() => session.answerRequest(ok))
      if (answered?.value) toast.success(sentMessage(answered.value))
    })()
  }

  const request = (): void => {
    if (session && run(() => session.requestWorkspace(start || undefined))) setWaiting(true)
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
            <Field label="Récupérer à partir du (facultatif)" hint="Vide : la date choisie sur le serveur, sinon tout l'historique.">
              {(id) => <DateInput id={id} value={start} onChange={(e) => setStart(e.target.value)} />}
            </Field>
            <Button full variant="secondary" disabled={waiting} onClick={request}><DownloadIcon className="size-5" />{waiting ? 'En attente du serveur…' : 'Récupérer les données'}</Button>
            <Button full variant="ghost" onClick={disconnect}>Se déconnecter</Button>
            <p className="text-xs text-muted">Avant tout envoi, vos données sont <strong>vérifiées</strong> et vous confirmez. Les données reçues sont d'abord <strong>validées</strong>, puis enregistrées seulement après votre accord : vous choisirez d'<strong>ajouter</strong> les portefeuilles ou de <strong>remplacer</strong> vos données.</p>
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
      {preview && <ImportSheet fromServer preview={preview} onClose={() => setPreview(null)} />}
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
