/**
 * @fileoverview Credential-Cipher – AES-256-GCM Verschluesselung fuer Secrets at-rest.
 *
 * @description
 * Low-Level-Baustein fuer die Verschluesselung von Storage-Zugangsdaten
 * (Nextcloud-App-Passwort, OAuth-Client-Secret/-Tokens, API-Keys), die in der
 * MongoDB-`libraries`-Collection persistiert werden. Verwendet AES-256-GCM
 * (authentifizierte Verschluesselung) mit einem 32-Byte-Schluessel aus der
 * Umgebungsvariable `CREDENTIALS_ENCRYPTION_KEY`.
 *
 * Wert-Format (selbstbeschreibend, versioniert):
 *   `enc:v1:<base64( iv[12] | authTag[16] | ciphertext )>`
 *
 * Contract (no-silent-fallbacks):
 * - Fehlt der Schluessel, wird beim Ver-/Entschluesseln ein expliziter Fehler
 *   geworfen – NIE still auf Klartext zurueckgefallen.
 * - `decryptSecret` laesst Legacy-Klartext (ohne `enc:v1:`-Praefix) bewusst und
 *   sichtbar (Warnung, ohne den Wert) durch, damit bestehende Daten lesbar
 *   bleiben, bis die Migration sie verschluesselt hat.
 * - Es werden NIEMALS Secret-Werte geloggt.
 *
 * @module security
 *
 * @exports
 * - isEncryptedSecret: Prueft, ob ein Wert bereits ein `enc:v1:`-Token ist
 * - encryptSecret: Verschluesselt einen Klartext-String (idempotent)
 * - decryptSecret: Entschluesselt ein Token (Legacy-Klartext bleibt unveraendert)
 *
 * @dependencies
 * - node:crypto: AES-256-GCM Primitive
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Versioniertes Praefix; erlaubt spaeter Schluessel-/Algorithmus-Rotation. */
export const ENCRYPTED_SECRET_PREFIX = 'enc:v1:'

const ENV_KEY_NAME = 'CREDENTIALS_ENCRYPTION_KEY'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 Bit, GCM-Empfehlung
const AUTH_TAG_LENGTH = 16 // 128 Bit
const KEY_LENGTH = 32 // 256 Bit

/**
 * Liest und dekodiert den 32-Byte-Schluessel aus der Umgebung.
 * Akzeptiert Hex (64 Zeichen) oder Base64. Wirft explizit bei fehlendem oder
 * ungueltigem Schluessel (kein stiller Fallback).
 */
function getEncryptionKey(): Buffer {
  const raw = process.env[ENV_KEY_NAME]?.trim()
  if (!raw) {
    throw new Error(
      `${ENV_KEY_NAME} ist nicht gesetzt. Storage-Zugangsdaten koennen ohne ` +
        `Verschluesselungsschluessel nicht sicher verarbeitet werden. ` +
        `Schluessel generieren: \`openssl rand -base64 32\`.`,
    )
  }

  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `${ENV_KEY_NAME} muss 32 Byte lang sein (Hex mit 64 Zeichen oder ` +
        `Base64). Aktuell dekodiert: ${key.length} Byte.`,
    )
  }
  return key
}

/**
 * Prueft, ob ein Wert bereits ein verschluesseltes Token ist.
 */
export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_SECRET_PREFIX)
}

/**
 * Verschluesselt einen Klartext-Secret-String mit AES-256-GCM.
 *
 * Idempotent: Ein bereits verschluesselter Wert wird unveraendert
 * zurueckgegeben (verhindert Doppel-Verschluesselung bei Re-Saves/Migration).
 *
 * @throws wenn `CREDENTIALS_ENCRYPTION_KEY` fehlt/ungueltig ist.
 */
export function encryptSecret(plaintext: string): string {
  if (isEncryptedSecret(plaintext)) return plaintext

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, ciphertext]).toString('base64')
  return `${ENCRYPTED_SECRET_PREFIX}${payload}`
}

/**
 * Entschluesselt ein `enc:v1:`-Token zurueck zum Klartext.
 *
 * Legacy-Verhalten (Migration): Werte ohne `enc:v1:`-Praefix gelten als
 * unverschluesselter Bestand und werden – mit sichtbarer Warnung (ohne Wert) –
 * unveraendert zurueckgegeben. So bleibt die App vor der Daten-Migration
 * funktionsfaehig.
 *
 * @throws wenn ein verschluesseltes Token vorliegt, aber der Schluessel fehlt,
 *         oder wenn die Authentifizierung (GCM-Tag) fehlschlaegt.
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) {
    // Kein Praefix => Legacy-Klartext. Bewusst sichtbar, ohne den Wert zu loggen.
    console.warn(
      '[credential-cipher] Unverschluesseltes Legacy-Secret gelesen – bitte ' +
        '`pnpm tsx scripts/migrate-encrypt-credentials.ts` ausfuehren.',
    )
    return value
  }

  const key = getEncryptionKey()
  const payload = Buffer.from(value.slice(ENCRYPTED_SECRET_PREFIX.length), 'base64')
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Ungueltiges Secret-Token: IV/AuthTag-Laenge stimmt nicht.')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
