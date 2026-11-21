/**
 * Adresse du serveur distant. Le QR code (ou l'utilisateur) fournit l'URL affichée par le serveur, par exemple
 * `http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA` ; la connexion se fait en WebSocket sur `/ws?token=zLhJ-QcsSdyX2bOC3o6SjA`.
 */
import { DomainError } from '@/domain/errors'

export function toSocketUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new DomainError('Adresse invalide : recopiez l\u2019adresse affichée par le serveur (ex. http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA).')
  }
  const secure = url.protocol === 'https:' || url.protocol === 'wss:'
  if (!secure && url.protocol !== 'http:' && url.protocol !== 'ws:') {
    throw new DomainError('Adresse invalide : elle doit commencer par http://, https://, ws:// ou wss://.')
  }
  const token = url.searchParams.get('token')
  if (!token) throw new DomainError('Adresse incomplète : le paramètre « token » est absent (ex. http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA).')
  return `${secure ? 'wss' : 'ws'}://${url.host}/ws?token=${encodeURIComponent(token)}`
}
