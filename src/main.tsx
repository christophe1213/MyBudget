import { createRoot } from 'react-dom/client'
import { createWorkspaceService } from './bootstrap'
import './index.css'
import { App } from './ui/App'

createRoot(document.getElementById('root')!).render(<App service={createWorkspaceService()} />)

// Fonctionnement hors ligne : on ne l'active qu'en production (en développement il masquerait les modifications).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined)
  })
}
