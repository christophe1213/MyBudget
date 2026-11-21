/** Connexion au serveur distant par WebSocket (navigateur). */
import { SyncError, type SyncConnection, type SyncGateway, type SyncMessage } from '@/application/ports'

const CONNECT_TIMEOUT_MS = 8000
const REFUSED = 4403   // code de fermeture envoyé par le serveur quand le jeton (token) est invalide

class WebSocketConnection implements SyncConnection {
  private readonly messageListeners = new Set<(message: SyncMessage) => void>()
  private readonly closeListeners = new Set<(reason: string) => void>()

  constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      let message: unknown
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return   // message qui n'est pas du JSON : ignoré
      }
      if (typeof message === 'object' && message !== null && typeof (message as SyncMessage).type === 'string') {
        this.messageListeners.forEach((listener) => listener(message as SyncMessage))
      }
    })
    socket.addEventListener('close', () => this.closeListeners.forEach((listener) => listener('La connexion avec le serveur est terminée.')))
  }

  send(message: SyncMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) throw new SyncError('La connexion est fermée : reconnectez-vous.')
    this.socket.send(JSON.stringify(message))
  }

  onMessage(listener: (message: SyncMessage) => void): void {
    this.messageListeners.add(listener)
  }

  onClose(listener: (reason: string) => void): void {
    this.closeListeners.add(listener)
  }

  close(): void {
    this.socket.close()
  }
}

export class WebSocketGateway implements SyncGateway {
  connect(socketUrl: string): Promise<SyncConnection> {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && socketUrl.startsWith('ws:')) {
      return Promise.reject(new SyncError(
        "Le navigateur bloque une connexion non sécurisée (ws://) depuis une page en HTTPS. Utilisez une adresse https://, ou ouvrez l'application depuis le serveur local (http://).",
      ))
    }
    return new Promise((resolve, reject) => {
      let socket: WebSocket
      try {
        socket = new WebSocket(socketUrl)
      } catch {
        reject(new SyncError("Adresse refusée par le navigateur : vérifiez l'adresse du serveur."))
        return
      }
      const fail = (error: SyncError): void => {
        clearTimeout(timer)
        reject(error)
      }
      const timer = setTimeout(() => {
        socket.close()
        fail(new SyncError('Le serveur ne répond pas. Vérifiez l\u2019adresse et que les deux appareils sont sur le même réseau.'))
      }, CONNECT_TIMEOUT_MS)
      socket.addEventListener('open', () => {
        clearTimeout(timer)
        resolve(new WebSocketConnection(socket))
      })
      socket.addEventListener('close', (event) => {   // sans effet une fois la connexion ouverte : la promesse est déjà réglée
        fail(new SyncError(event.code === REFUSED
          ? 'Session refusée : le QR code a peut-être expiré. Scannez-le à nouveau.'
          : 'Connexion impossible. Vérifiez l\u2019adresse et que les deux appareils sont sur le même réseau.'))
      })
    })
  }
}
