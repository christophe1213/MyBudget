import type { IsoDate } from './dates'

export type Kind = 'expense' | 'deposit'

export interface Transaction {
  readonly id: string
  readonly date: IsoDate
  readonly category: string
  readonly kind: Kind
  readonly label: string
  /** En Ariary, entier strictement positif : le sens est donné par `kind`. */
  readonly amount: number
}

export interface Category {
  readonly name: string
  /** Budget par jour en Ariary ; 0 = pas de budget. */
  readonly dailyBudget: number
  /** Solde de départ en Ariary, entier positif ou nul : argent déjà présent dans la catégorie avant sa première transaction. */
  readonly initialBalance: number
}

/** Un portefeuille = un livre de comptes. */
export interface Wallet {
  readonly id: string
  readonly name: string
  readonly initialBalance: number
  readonly categories: readonly Category[]
  readonly transactions: readonly Transaction[]
}

export interface Workspace {
  readonly activeWalletId: string
  readonly wallets: readonly Wallet[]
}

export const signedAmount = (t: Transaction): number => (t.kind === 'deposit' ? t.amount : -t.amount)
