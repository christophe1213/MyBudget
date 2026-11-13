/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Hors ligne dès la première visite : après le build, écrit dans dist/sw.js la liste de tous les fichiers à mettre en cache
 *  et une version (empreinte de leur contenu) qui renouvelle le cache à chaque déploiement. */
function precacheManifest(): Plugin {
  let outDir = ''
  const listFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? listFiles(path) : [path]
    })

  return {
    name: 'repere-precache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js')
      if (!existsSync(swPath)) throw new Error('precache : dist/sw.js introuvable (public/sw.js manquant ?)')
      const source = readFileSync(swPath, 'utf8')
      if (!source.includes("const VERSION = 'dev'") || !source.includes('const FILES = []')) {
        throw new Error('precache : repères VERSION / FILES introuvables dans sw.js')
      }
      const files = listFiles(outDir)
        .map((path) => relative(outDir, path).split(sep).join('/'))
        .filter((file) => file !== 'sw.js')
        .sort()
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))
      writeFileSync(
        swPath,
        source
          .replace("const VERSION = 'dev'", `const VERSION = '${hash.digest('hex').slice(0, 12)}'`)
          .replace('const FILES = []', `const FILES = ${JSON.stringify(files)}`),
      )
    },
  }
}

export default defineConfig({
  base: './', // chemins relatifs : le dossier dist se déploie n'importe où (GitHub Pages, sous-dossier, domaine)
  plugins: [react(), tailwindcss(), precacheManifest()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
