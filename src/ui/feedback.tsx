/** Messages de retour : notifications brèves (toasts) et confirmations (feuille avec deux boutons). */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './components/ui'
import { Sheet } from './components/Sheet'

interface Toast { id: number; kind: 'success' | 'error'; message: string }
interface Toasts { success(message: string): void; error(message: string): void }
interface ConfirmOptions { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean }
type Confirm = (options: ConfirmOptions) => Promise<boolean>

const ToastContext = createContext<Toasts | null>(null)
const ConfirmContext = createContext<Confirm | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const [pending, setPending] = useState<{ options: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = (nextId.current += 1)
    setToasts((list) => [...list, { id, kind, message }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), kind === 'error' ? 6500 : 3200)
  }, [])
  const toast = useMemo<Toasts>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m) }), [push])
  const confirm = useCallback<Confirm>((options) => new Promise((resolve) => setPending({ options, resolve })), [])
  const answer = (ok: boolean): void => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {toasts.map((t) => (
            <p key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto w-full max-w-md animate-[toast-in_0.18s_ease-out] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === 'error' ? 'bg-danger' : 'bg-brand-700'}`}>
              {t.message}
            </p>
          ))}
        </div>
        <Sheet open={pending !== null} onClose={() => answer(false)} title={pending?.options.title ?? ''}
          footer={pending && (
            <>
              <Button full variant={pending.options.danger ? 'danger' : 'primary'} onClick={() => answer(true)}>{pending.options.confirmLabel ?? 'Confirmer'}</Button>
              <Button full variant="ghost" onClick={() => answer(false)}>Annuler</Button>
            </>
          )}>
          {pending?.options.message && <div className="text-sm text-muted">{pending.options.message}</div>}
        </Sheet>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): Toasts {
  const value = useContext(ToastContext)
  if (!value) throw new Error('FeedbackProvider manquant')
  return value
}

export function useConfirm(): Confirm {
  const value = useContext(ConfirmContext)
  if (!value) throw new Error('FeedbackProvider manquant')
  return value
}
