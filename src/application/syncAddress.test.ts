import { DomainError } from '@/domain/errors'
import { toSocketUrl } from './syncAddress'

describe("adresse du serveur : QR code ou saisie → URL WebSocket", () => {
  it('http → ws, https → wss, sur /ws avec le jeton de session', () => {
    expect(toSocketUrl('http://192.168.1.20:8000/?token=zLhJ-QcsSdyX2bOC3o6SjA')).toBe('ws://192.168.1.20:8000/ws?token=zLhJ-QcsSdyX2bOC3o6SjA')
    expect(toSocketUrl('https://sync.exemple.mg/?token=zLhJ-QcsSdyX2bOC3o6SjA')).toBe('wss://sync.exemple.mg/ws?token=zLhJ-QcsSdyX2bOC3o6SjA')
  })

  it('accepte une adresse ws:// ou wss:// et ignore les espaces autour', () => {
    expect(toSocketUrl('  ws://10.0.0.5:9000/ws?token=x1  ')).toBe('ws://10.0.0.5:9000/ws?token=x1')
    expect(toSocketUrl('wss://h.mg/ws?token=x1')).toBe('wss://h.mg/ws?token=x1')
  })

  it('l\u2019ancien paramètre « session » n\u2019est pas reconnu', () => {
    expect(() => toSocketUrl('http://192.168.1.20:8000/?session=ABC123')).toThrow(/token/)
  })

  it("refuse ce qui n'est pas une adresse de serveur, avec un message clair", () => {
    for (const bad of ['', 'bonjour', '192.168.1.20:8000/?token=a', 'ftp://h/?token=a', 'mailto:a@b.c']) {
      expect(() => toSocketUrl(bad), bad).toThrow(DomainError)
    }
    expect(() => toSocketUrl('http://192.168.1.20:8000/')).toThrow(/token/)
    expect(() => toSocketUrl('http://192.168.1.20:8000/?token=')).toThrow(/token/)
  })
})
