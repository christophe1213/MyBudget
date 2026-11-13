import '@testing-library/jest-dom/vitest'

// jsdom ne sait pas faire défiler la page : on neutralise l'appel (sinon il écrit une erreur dans la console).
window.scrollTo = vi.fn()
