/**
 * @fileoverview Signierte Account-Keys der MCP-Bruecke (Stufe 2, edge-tauglich).
 *
 * @description
 * Per-Account-Keys leben in MongoDB — aber die Clerk-Middleware (Edge, kein
 * Mongo) maskiert `/api/mcp/*` als 404 und muss gueltige Keys OHNE Datenbank
 * erkennen. Deshalb sind Account-Keys selbsttragend signiert:
 *
 *   `ksm_<b64url(email)>~<nonceHex>~<hmacHex>`
 *
 * mit HMAC-SHA256 ueber `email.nonce`, Secret = `MCP_API_KEY`. Trennzeichen
 * ist `~` (RFC-6750-token68), NICHT `.`: drei punktgetrennte Segmente sehen
 * fuer Clerk wie ein Session-JWT aus — die clerkMiddleware parst jeden
 * JWT-foermigen Bearer-Header und wirft bei Nicht-JSON-Payload einen 500
 * (Live-Befund beim Pilot-Smoke-Test). Die Middleware
 * prueft NUR die Signatur (Maske faellt fuer valide Keys); die Route ist die
 * Autoritaet und prueft ZUSAETZLICH den Hash gegen die Datenbank — so
 * invalidiert eine Rotation alte Keys trotz gueltiger Signatur.
 *
 * Nur Web-APIs (crypto.subtle, TextEncoder, btoa) — kein Node-Import, damit
 * die Middleware das Modul laden kann.
 *
 * @module mcp
 */

const KEY_PREFIX = 'ksm_'

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): string | null {
  try {
    // atob der Edge-Runtime ist strikt: ohne =-Padding wirft es — Padding
    // deterministisch ergaenzen (b64url laesst es weg).
    const base = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base + '='.repeat((4 - (base.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToHex(signature)
}

/** Konstantzeit-Vergleich zweier Hex-Strings (gleiche Laenge vorausgesetzt). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** SHA-256 als Hex — Speicherform der Keys in MongoDB (nie Klartext). */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(digest)
}

/** Baut einen signierten Account-Key. Wirft bei leerem Secret/Email (kein stiller Leer-Key). */
export async function buildMcpAccountKey(args: {
  userEmail: string
  nonceHex: string
  secret: string
}): Promise<string> {
  const email = args.userEmail.trim()
  if (email === '') throw new Error('Account-Key: userEmail ist leer')
  if (args.secret.trim() === '') throw new Error('Account-Key: Signatur-Secret (MCP_API_KEY) ist leer')
  if (!/^[0-9a-f]{16,}$/.test(args.nonceHex)) throw new Error('Account-Key: nonceHex ungueltig')
  const signature = await hmacHex(args.secret, `${email}.${args.nonceHex}`)
  return `${KEY_PREFIX}${base64UrlEncode(email)}~${args.nonceHex}~${signature}`
}

export interface ParsedMcpAccountKey {
  userEmail: string
  nonceHex: string
  signatureHex: string
}

/** Zerlegt einen Key-String; `null` fuer alles, was kein Account-Key-Format hat. */
export function parseMcpAccountKey(key: string): ParsedMcpAccountKey | null {
  if (!key.startsWith(KEY_PREFIX)) return null
  const parts = key.slice(KEY_PREFIX.length).split('~')
  if (parts.length !== 3) return null
  const [emailPart, nonceHex, signatureHex] = parts
  if (!/^[0-9a-f]{16,}$/.test(nonceHex) || !/^[0-9a-f]{64}$/.test(signatureHex)) return null
  const userEmail = base64UrlDecode(emailPart)
  if (userEmail === null || userEmail.trim() === '') return null
  return { userEmail, nonceHex, signatureHex }
}

/**
 * Prueft die Signatur eines Account-Keys gegen das Secret.
 * Liefert die Email des Key-Inhabers — oder `null` (kein Format / Signatur falsch).
 */
export async function verifyMcpAccountKey(key: string, secret: string): Promise<string | null> {
  if (secret.trim() === '') return null
  const parsed = parseMcpAccountKey(key)
  if (!parsed) return null
  const expected = await hmacHex(secret, `${parsed.userEmail}.${parsed.nonceHex}`)
  return timingSafeEqualHex(expected, parsed.signatureHex) ? parsed.userEmail : null
}
