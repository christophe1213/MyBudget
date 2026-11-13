/** Petit système de composants : une seule charte, des zones tactiles d'au moins 44 px. */
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { formatNumber } from '@/ui/format'

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section {...rest} className={`rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(30,42,36,0.04)] ${className}`}>{children}</section>
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold">{children}</h2>
      {aside}
    </div>
  )
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-1 pb-1 pt-2">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </header>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white active:bg-brand-700 hover:bg-brand-700',
  secondary: 'border border-brand-600 bg-white text-brand-700 active:bg-brand-50 hover:bg-brand-50',
  danger: 'border border-danger bg-white text-danger active:bg-danger-50 hover:bg-danger-50',
  ghost: 'text-brand-700 active:bg-brand-50 hover:bg-brand-50',
}

export function Button({ variant = 'primary', full = false, small = false, className = '', type = 'button', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean; small?: boolean }) {
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50 ${small ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-[15px]'} ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children(id)}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

const INPUT = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-ink placeholder:text-muted/70 focus:border-brand-600 disabled:bg-surface'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="date" className={`${INPUT} ${props.className ?? ''}`} />
}

/** Montant : clavier numérique sur téléphone, milliers séparés pendant la saisie. */
export function AmountInput({ value, onChange, ...rest }: { value: string; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <TextInput
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
        onChange(digits ? formatNumber(Number(digits)) : '')
      }}
    />
  )
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} appearance-none bg-[length:1rem] bg-[position:right_0.75rem_center] bg-no-repeat pr-9 ${props.className ?? ''}`}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7b72' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} />
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-brand-50 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${o.value === value ? 'bg-brand-600 text-white shadow-sm' : 'text-brand-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ children, onClick, active = false }: { children: ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`min-h-9 rounded-full border px-3.5 text-sm font-semibold transition ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-brand-700 active:bg-brand-50'}`}>
      {children}
    </button>
  )
}

type Tone = 'info' | 'warn' | 'danger' | 'success'
const TONES: Record<Tone, string> = {
  info: 'bg-info-50 text-ink', warn: 'bg-warn-50 text-ink', danger: 'bg-danger-50 text-ink', success: 'bg-brand-50 text-ink',
}

export function Notice({ tone = 'info', children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm ${TONES[tone]}`}>
      <p className="min-w-0 flex-1">{children}</p>
      {action}
    </div>
  )
}

export function Stat({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'positive' | 'negative' }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${tone === 'positive' ? 'text-brand-700' : tone === 'negative' ? 'text-danger' : ''}`}>{value}</p>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function PeriodFields({ start, end, onStart, onEnd, error }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; error?: string | null }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Du">{(id) => <DateInput id={id} value={start} onChange={(e) => onStart(e.target.value)} />}</Field>
        <Field label="Au">{(id) => <DateInput id={id} value={end} onChange={(e) => onEnd(e.target.value)} />}</Field>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  )
}
