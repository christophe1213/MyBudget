/**
 * Garde-fou d'architecture : les dépendances ne vont que vers l'intérieur.
 *
 *     interface (ui) ─┐
 *                     ├──► application ──► domaine
 *     adaptateurs ────┘
 *
 * Un import interdit fait échouer ce test : l'architecture ne peut pas se dégrader sans qu'on le voie.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname)

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const sources = files(ROOT).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.includes(`${ROOT}/test/`))
const layerOf = (path: string): string => relative(ROOT, path).split('/')[0]!.replace(/\.(ts|tsx)$/, '')

/** Couche visée par un import (null pour une bibliothèque externe). */
function importsOf(file: string): { target: string | null; raw: string }[] {
  const text = readFileSync(file, 'utf8')
  const found = [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!)
  return found.map((raw) => {
    if (raw.startsWith('@/')) return { target: raw.slice(2).split('/')[0]!, raw }
    if (raw.startsWith('.')) return { target: layerOf(resolve(dirname(file), raw)), raw }
    return { target: null, raw }
  })
}

const ALLOWED: Record<string, string[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  adapters: ['domain', 'application', 'adapters'],
  ui: ['domain', 'application', 'ui'],
}

describe('architecture', () => {
  it('chaque couche n\'importe que ses couches intérieures', () => {
    const violations = sources.flatMap((file) => {
      const layer = layerOf(file)
      const allowed = ALLOWED[layer]
      if (!allowed) return []
      return importsOf(file).filter((i) => i.target !== null && !allowed.includes(i.target)).map((i) => `${relative(ROOT, file)} -> ${i.raw}`)
    })
    expect(violations).toEqual([])
  })

  it('le domaine et l\'application n\'utilisent aucune bibliothèque externe (React compris)', () => {
    const violations = sources
      .filter((f) => ['domain', 'application'].includes(layerOf(f)))
      .flatMap((file) => importsOf(file).filter((i) => i.target === null).map((i) => `${relative(ROOT, file)} -> ${i.raw}`))
    expect(violations).toEqual([])
  })

  it('le domaine et l\'application ne touchent ni au navigateur ni au stockage', () => {
    const forbidden = /\b(window|document|localStorage|sessionStorage|navigator|fetch|indexedDB)\b/
    const violations = sources
      .filter((f) => ['domain', 'application'].includes(layerOf(f)))
      .filter((f) => forbidden.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map((f) => relative(ROOT, f))
    expect(violations).toEqual([])
  })

  it('seuls bootstrap.ts et main.tsx connaissent les adaptateurs concrets', () => {
    const violations = sources
      .filter((f) => layerOf(f) !== 'adapters' && !['bootstrap', 'main'].includes(layerOf(f)))
      .flatMap((file) => importsOf(file).filter((i) => i.target === 'adapters' || i.target === 'bootstrap').map((i) => `${relative(ROOT, file)} -> ${i.raw}`))
    expect(violations).toEqual([])
  })
})
