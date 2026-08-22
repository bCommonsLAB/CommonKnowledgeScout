/**
 * @fileoverview Service fuer MCP-Account-Keys: erzeugen/rotieren + aufloesen.
 *
 * @description
 * Verbindet die reine Signatur-Schicht (`account-key.ts`, edge-tauglich) mit
 * dem Hash-Speicher (`mcp-keys-repo.ts`, Mongo). Der Klartext-Key existiert
 * GENAU EINMAL: als Rueckgabe von `rotateMcpAccountKey` — danach nur noch
 * sein Hash. Secret der Signatur ist `MCP_API_KEY` (dient zugleich weiter
 * als Legacy-Pilot-Key, siehe `auth.ts`).
 *
 * @module mcp
 */

import { randomBytes } from 'node:crypto'
import { buildMcpAccountKey, sha256Hex, verifyMcpAccountKey } from './account-key'
import {
  deleteMcpAccountKey,
  getMcpAccountKeyDoc,
  upsertMcpAccountKeyHash,
} from '@/lib/repositories/mcp-keys-repo'

/** Signatur-Secret aus der Umgebung; wirft statt still ohne Secret zu signieren. */
function requireSecret(): string {
  const secret = process.env.MCP_API_KEY?.trim() ?? ''
  if (secret === '') {
    throw new Error('MCP_API_KEY nicht konfiguriert — ohne Secret keine Account-Keys')
  }
  return secret
}

/**
 * Erzeugt (bzw. rotiert) den Account-Key eines Users und speichert den Hash.
 * Rueckgabe ist der einzige Moment, in dem der Klartext existiert.
 */
export async function rotateMcpAccountKey(userEmail: string): Promise<string> {
  const secret = requireSecret()
  const nonceHex = randomBytes(16).toString('hex')
  const key = await buildMcpAccountKey({ userEmail, nonceHex, secret })
  await upsertMcpAccountKeyHash(userEmail, await sha256Hex(key))
  return key
}

/**
 * Loest ein Bearer-Token als Account-Key auf: Signatur pruefen, dann Hash
 * gegen die Datenbank (Rotation/Widerruf). `null` = kein gueltiger Account-Key.
 */
export async function resolveMcpAccountKey(token: string): Promise<string | null> {
  const secret = process.env.MCP_API_KEY?.trim() ?? ''
  const userEmail = await verifyMcpAccountKey(token, secret)
  if (userEmail === null) return null
  const doc = await getMcpAccountKeyDoc(userEmail)
  if (!doc) return null
  return doc.keyHash === (await sha256Hex(token)) ? userEmail : null
}

/** Status fuer die Account-Seite — ohne Key-Material. */
export async function getMcpAccountKeyStatus(
  userEmail: string,
): Promise<{ configured: boolean; updatedAt: string | null }> {
  const doc = await getMcpAccountKeyDoc(userEmail)
  return { configured: doc !== null, updatedAt: doc?.updatedAt ?? null }
}

/** Widerruft den Account-Key (Erweiterung verliert den Zugang). */
export async function revokeMcpAccountKey(userEmail: string): Promise<boolean> {
  return deleteMcpAccountKey(userEmail)
}
