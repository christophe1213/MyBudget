import { formatAr, formatDate, formatDayFull, formatDayLong, formatDayShort, formatNumber, formatPercent, formatSigned, parseAmount, parseAmountOrZero } from './format'

describe('formatage', () => {
  it('montants avec espaces insécables (jamais coupés en fin de ligne)', () => {
    expect(formatNumber(30000)).toBe('30\u00a0000')
    expect(formatAr(1234567)).toBe('1\u00a0234\u00a0567\u00a0Ar')
    expect(formatAr(0)).toBe('0\u00a0Ar')
    expect(formatAr(1733.4)).toBe('1\u00a0733\u00a0Ar')
  })

  it('montants signés', () => {
    expect(formatSigned(4000)).toBe('+4\u00a0000\u00a0Ar')
    expect(formatSigned(-4000)).toBe('\u22124\u00a0000\u00a0Ar')
    expect(formatSigned(0)).toBe('0\u00a0Ar')
  })

  it('pourcentages avec virgule', () => {
    expect(formatPercent(33.3)).toBe('33,3\u00a0%')
    expect(formatPercent(100)).toBe('100,0\u00a0%')
  })

  it('dates en français', () => {
    expect(formatDate('2026-10-20')).toBe('20/10/2026')
    expect(formatDayShort('2026-10-20')).toBe('20 oct.')
    expect(formatDayShort('2026-03-05')).toBe('5 mars')
    expect(formatDayLong('2026-10-20')).toBe('20 octobre')
    expect(formatDayFull('2026-10-20')).toBe('mardi 20 octobre 2026')
  })
})

describe('lecture des montants saisis', () => {
  it('accepte espaces, « Ar » et séparateurs', () => {
    expect(parseAmount('3 200')).toBe(3200)
    expect(parseAmount('3\u00a0200 Ar')).toBe(3200)
    expect(parseAmount('12000')).toBe(12000)
  })

  it('refuse 0, vide et texte', () => {
    for (const bad of ['', '0', 'abc', '-5', ' ']) expect(parseAmount(bad)).toBeNull()
  })

  it('« ou zéro » accepte aussi 0 et le champ vide', () => {
    expect(parseAmountOrZero('')).toBe(0)
    expect(parseAmountOrZero('0')).toBe(0)
    expect(parseAmountOrZero('1 500')).toBe(1500)
    expect(parseAmountOrZero('abc')).toBeNull()
  })
})
