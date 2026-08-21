/**
 * @fileoverview Repository fuer MCP-Account-Keys (Hash-Speicher, Stufe 2).
 *
 * @description
 * EIN aktiver Key pro Account (userEmail), gespeichert als SHA-256-Hex —
 * nie Klartext. Rotation ueberschreibt den Hash; alte Keys scheitern damit
 * am Datenbank-Abgleich der Route (trotz gueltiger Signatur, siehe
 * `src/lib/mcp/account-key.ts`).
 *
 * Bewusste Abweichung vom Per-Library-Muster (mongodb-repository-pattern.md):
 * Keys sind ACCOUNT-Domaene, nicht Library-Domaene — eine globale Collection
 * `mcp_account_keys`, fachlicher Key ist die userEmail (unique).
 *
 * @module repositories
 */

import type { Collection } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

export interface McpAccountKeyDoc {
  _id?: string
  userEmail: string
  /** SHA-256-Hex des vollstaendigen Keys (Klartext existiert nur beim Erzeugen). */
  keyHash: string
  createdAt: string
  updatedAt: string
}

const COLLECTION = 'mcp_account_keys'

let collectionCache: Collection<McpAccountKeyDoc> | null = null
let indexEnsured = false

async function getCol(): Promise<Collection<McpAccountKeyDoc>> {
  if (collectionCache) return collectionCache
  collectionCache = await getCollection<McpAccountKeyDoc>(COLLECTION)
  return collectionCache
}

async function ensureIndexes(): Promise<void> {
  if (indexEnsured) return
  const col = await getCol()
  await col.createIndex({ userEmail: 1 }, { unique: true })
  indexEnsured = true
}

/** Setzt (oder rotiert) den Key-Hash eines Accounts. */
export async function upsertMcpAccountKeyHash(userEmail: string, keyHash: string): Promise<void> {
  const email = userEmail.trim()
  if (email === '') throw new Error('MCP-Key-Repo: userEmail ist leer')
  if (!/^[0-9a-f]{64}$/.test(keyHash)) throw new Error('MCP-Key-Repo: keyHash ist kein SHA-256-Hex')
  await ensureIndexes()
  const col = await getCol()
  const now = new Date().toISOString()
  await col.updateOne(
    { userEmail: email },
    { $set: { keyHash, updatedAt: now }, $setOnInsert: { userEmail: email, createdAt: now } },
    { upsert: true },
  )
}

/** Liest den Key-Eintrag eines Accounts; `null` = noch kein Key erzeugt. */
export async function getMcpAccountKeyDoc(userEmail: string): Promise<McpAccountKeyDoc | null> {
  const email = userEmail.trim()
  if (email === '') throw new Error('MCP-Key-Repo: userEmail ist leer')
  const col = await getCol()
  return col.findOne({ userEmail: email })
}

/** Widerruft den Key eines Accounts (Eintrag entfernen). */
export async function deleteMcpAccountKey(userEmail: string): Promise<boolean> {
  const email = userEmail.trim()
  if (email === '') throw new Error('MCP-Key-Repo: userEmail ist leer')
  const col = await getCol()
  const result = await col.deleteOne({ userEmail: email })
  return result.deletedCount === 1
}
