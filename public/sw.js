/* Fonctionnement hors ligne.
   - À l'installation, TOUS les fichiers de l'application sont mis en cache (liste écrite au build par vite.config.ts) :
     dès la première visite, l'application démarre sans connexion.
   - Pages : réseau d'abord (on voit toujours la dernière version), copie du cache en secours.
   - Autres fichiers : cache d'abord.
   Les données, elles, sont dans le localStorage et n'ont rien à voir avec ce cache. */
const VERSION = 'dev' // remplacé au build : empreinte du contenu de dist/
const FILES = [] // remplacé au build : tous les fichiers de dist/
const CACHE = `repere-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('index.html')))
    return
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})
