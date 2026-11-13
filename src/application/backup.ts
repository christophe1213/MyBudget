/**
 * Format JSON de l'application (sauvegarde exportée ET contenu du stockage local) :
 *
 *   { "format": "repere", "version": 1, "exportedAt": "...", "activeWalletId": "...",
 *     "wallets": [ { "id", "name", "initialBalance", "categories": [{ "name", "dailyBudget" }],
 *                    "transactions": [{ "id", "date": "AAAA-MM-JJ", "category", "kind": "expense"|"deposit",
 *                                      "label", "amount" }] } ] }
 *
 * La lecture est tolérante (identifiants manquants, catégories absentes de la liste...) pour accepter des
 * fichiers édités à la main ou produits par d'autres outils ; elle est stricte sur ce qui rendrait les
 * comptes faux (dates impossibles, montants invalides, types inconnus).
 */
import { isIsoDate } from '@/domain/dates'
import { DomainError } from '@/domain/errors'
import { normalizeWallet } from '@/domain/ledger'
import type { Category, Kind, Transaction, Wallet, Workspace } from '@/domain/model'

export const BACKUP_FORMAT = 'repere'
export const BACKUP_VERSION = 1

export function serializeWorkspace(ws: Workspace, exportedAt?: string): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, activeWalletId: ws.activeWalletId, wallets: ws.wallets }, null, 2)
}

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const KINDS: Record<string, Kind> = { expense: 'expense', deposit: 'deposit', dépense: 'expense', depense: 'expense', dépôt: 'deposit', depot: 'deposit' }

function parseTransaction(raw: unknown, where: string, usedIds: Set<string>, newId: () => string): Transaction {
  if (!isObject(raw)) throw new DomainError(`${where} : format invalide.`)
  if (!isIsoDate(raw.date)) throw new DomainError(`${where} : date invalide (format attendu : AAAA-MM-JJ).`)
  const kind = typeof raw.kind === 'string' ? KINDS[raw.kind.trim().toLowerCase()] : undefined
  if (!kind) throw new DomainError(`${where} : type inconnu (attendu : expense ou deposit).`)
  if (typeof raw.amount !== 'number' || !Number.isFinite(raw.amount) || Math.round(raw.amount) <= 0) {
    throw new DomainError(`${where} : montant invalide (entier positif attendu).`)
  }
  if (typeof raw.category !== 'string' || !raw.category.trim()) throw new DomainError(`${where} : catégorie manquante.`)
  let id = typeof raw.id === 'string' && raw.id ? raw.id : newId()
  if (usedIds.has(id)) id = newId()
  usedIds.add(id)
  return { id, date: raw.date, category: raw.category.trim(), kind, label: typeof raw.label === 'string' ? raw.label.trim() : '', amount: Math.round(raw.amount) }
}

function parseCategories(raw: unknown, where: string): Category[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new DomainError(`${where} : la liste des catégories est invalide.`)
  const seen = new Map<string, Category>()
  for (const item of raw) {
    const name = typeof item === 'string' ? item : isObject(item) && typeof item.name === 'string' ? item.name : ''
    if (!name.trim()) throw new DomainError(`${where} : une catégorie n'a pas de nom.`)
    const budget = isObject(item) && typeof item.dailyBudget === 'number' ? Math.round(item.dailyBudget) : 0
    if (budget < 0) throw new DomainError(`${where} : le budget par jour de « ${name} » est négatif.`)
    const key = name.trim().toLocaleLowerCase('fr')
    if (!seen.has(key)) seen.set(key, { name: name.trim(), dailyBudget: budget })
  }
  return [...seen.values()]
}

export function parseWorkspace(text: string, newId: () => string): Workspace {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new DomainError("Ce fichier n'est pas un JSON valide.")
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) throw new DomainError("Ce fichier n'est pas une sauvegarde Repère.")
  if (typeof data.version !== 'number' || data.version < 1) throw new DomainError('Version de la sauvegarde invalide.')
  if (data.version > BACKUP_VERSION) throw new DomainError('Cette sauvegarde vient d\u2019une version plus récente de Repère : mettez l\u2019application à jour.')
  if (!Array.isArray(data.wallets) || data.wallets.length === 0) throw new DomainError('La sauvegarde ne contient aucun portefeuille.')

  const walletIds = new Set<string>()
  const names = new Set<string>()
  const wallets = data.wallets.map((raw, index): Wallet => {
    if (!isObject(raw)) throw new DomainError(`Portefeuille n°${index + 1} : format invalide.`)
    if (typeof raw.name !== 'string' || !raw.name.trim()) throw new DomainError(`Portefeuille n°${index + 1} : nom manquant.`)
    const base = raw.name.trim()
    let name = base
    for (let n = 2; names.has(name.toLocaleLowerCase('fr')); n += 1) name = `${base} (${n})`
    names.add(name.toLocaleLowerCase('fr'))
    let id = typeof raw.id === 'string' && raw.id ? raw.id : newId()
    if (walletIds.has(id)) id = newId()
    walletIds.add(id)
    const where = `Portefeuille « ${name} »`
    if (!Array.isArray(raw.transactions ?? [])) throw new DomainError(`${where} : la liste des transactions est invalide.`)
    const usedIds = new Set<string>()
    const transactions = ((raw.transactions ?? []) as unknown[]).map((t, i) => parseTransaction(t, `${where}, transaction n°${i + 1}`, usedIds, newId))
    const initial = raw.initialBalance === undefined ? 0 : raw.initialBalance
    if (typeof initial !== 'number' || !Number.isInteger(initial)) throw new DomainError(`${where} : le solde initial doit être un nombre entier.`)
    return normalizeWallet({ id, name, initialBalance: initial, categories: parseCategories(raw.categories, where), transactions })
  })
  const active = typeof data.activeWalletId === 'string' && walletIds.has(data.activeWalletId) ? data.activeWalletId : wallets[0]!.id
  return { activeWalletId: active, wallets }
}
