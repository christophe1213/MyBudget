/** Plus petit pas « rond » (1, 2 ou 5 × 10^n) supérieur ou égal à `value`, au moins 1. */
export function niceStep(value: number): number {
  const v = Math.max(value, 1)
  const power = 10 ** (String(Math.floor(v)).length - 1)
  for (const m of [1, 2, 5, 10]) if (v <= m * power) return m * power
  return 10 * power
}

/** Graduations de 0 à un maximum « rond » ≥ `max`, avec environ `ticks` intervalles. */
export function niceScale(max: number, ticks = 4): { step: number; top: number; values: number[] } {
  const step = niceStep(Math.max(max, 1) / ticks)
  const top = step * Math.ceil(Math.max(max, 1) / step)
  return { step, top, values: Array.from({ length: top / step + 1 }, (_, i) => i * step) }
}

/** Indices à étiqueter : au plus `max`, régulièrement espacés, toujours le premier et le dernier. */
export function labelIndices(count: number, max: number): Set<number> {
  const every = Math.max(1, Math.ceil(count / max))
  const set = new Set<number>()
  for (let i = 0; i < count; i += every) set.add(i)
  set.add(count - 1)
  return set
}
