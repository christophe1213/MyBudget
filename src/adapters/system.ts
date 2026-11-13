import type { Clock, IdGenerator } from '@/application/ports'
import type { IsoDate } from '@/domain/dates'

const two = (n: number): string => String(n).padStart(2, '0')

export class SystemClock implements Clock {
  /** Date du jour DANS LE FUSEAU DE L'UTILISATEUR (et non en UTC, qui décalerait le jour la nuit). */
  today(): IsoDate {
    const d = new Date()
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
  }

  nowIso(): string {
    return new Date().toISOString()
  }
}

export class UuidGenerator implements IdGenerator {
  next(): string {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}
