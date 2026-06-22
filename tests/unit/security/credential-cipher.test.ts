/**
 * Tests fuer den AES-256-GCM Credential-Cipher (Encryption-at-rest).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  ENCRYPTED_SECRET_PREFIX,
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from '@/lib/security/credential-cipher'

const TEST_KEY = randomBytes(32).toString('base64')

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
})

afterEach(() => {
  // Sicherstellen, dass nachfolgende Tests wieder einen gueltigen Schluessel sehen.
  process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY
})

describe('credential-cipher', () => {
  it('verschluesselt und entschluesselt verlustfrei (Round-Trip)', () => {
    const plaintext = 'super-geheimes-app-passwort-äöü-🔐'
    const token = encryptSecret(plaintext)
    expect(token.startsWith(ENCRYPTED_SECRET_PREFIX)).toBe(true)
    expect(token).not.toContain(plaintext)
    expect(decryptSecret(token)).toBe(plaintext)
  })

  it('erzeugt pro Aufruf unterschiedliche Tokens (zufaelliger IV)', () => {
    const a = encryptSecret('gleicher-wert')
    const b = encryptSecret('gleicher-wert')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('gleicher-wert')
    expect(decryptSecret(b)).toBe('gleicher-wert')
  })

  it('isEncryptedSecret erkennt Tokens und ignoriert Klartext', () => {
    expect(isEncryptedSecret(encryptSecret('x'))).toBe(true)
    expect(isEncryptedSecret('klartext')).toBe(false)
    expect(isEncryptedSecret('')).toBe(false)
    expect(isEncryptedSecret(undefined)).toBe(false)
    expect(isEncryptedSecret(42)).toBe(false)
  })

  it('encryptSecret ist idempotent (kein Doppel-Encrypt)', () => {
    const token = encryptSecret('einmal')
    expect(encryptSecret(token)).toBe(token)
  })

  it('decryptSecret laesst Legacy-Klartext unveraendert durch', () => {
    expect(decryptSecret('legacy-klartext-passwort')).toBe('legacy-klartext-passwort')
  })

  it('akzeptiert einen Hex-kodierten Schluessel', () => {
    const original = process.env.CREDENTIALS_ENCRYPTION_KEY
    try {
      process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('hex')
      const token = encryptSecret('hex-key-test')
      expect(decryptSecret(token)).toBe('hex-key-test')
    } finally {
      process.env.CREDENTIALS_ENCRYPTION_KEY = original
    }
  })

  it('erkennt Manipulation am Ciphertext (GCM-Auth-Tag)', () => {
    const token = encryptSecret('unveraenderlich')
    // Ein Byte im dekodierten Payload (IV-Bereich) kippen -> GCM-Auth schlaegt fehl.
    const payload = Buffer.from(token.slice(ENCRYPTED_SECRET_PREFIX.length), 'base64')
    payload[0] = payload[0] ^ 0xff
    const flipped = ENCRYPTED_SECRET_PREFIX + payload.toString('base64')
    expect(() => decryptSecret(flipped)).toThrow()
  })

  it('wirft explizit, wenn der Schluessel fehlt (no-silent-fallbacks)', () => {
    const original = process.env.CREDENTIALS_ENCRYPTION_KEY
    try {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
      expect(() => encryptSecret('x')).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
    } finally {
      process.env.CREDENTIALS_ENCRYPTION_KEY = original
    }
  })

  it('wirft, wenn ein Token vorliegt, aber der Schluessel fehlt', () => {
    const token = encryptSecret('x')
    const original = process.env.CREDENTIALS_ENCRYPTION_KEY
    try {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
      expect(() => decryptSecret(token)).toThrow(/CREDENTIALS_ENCRYPTION_KEY/)
    } finally {
      process.env.CREDENTIALS_ENCRYPTION_KEY = original
    }
  })

  it('wirft bei ungueltiger Schluessellaenge', () => {
    const original = process.env.CREDENTIALS_ENCRYPTION_KEY
    try {
      process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.from('zu-kurz').toString('base64')
      expect(() => encryptSecret('x')).toThrow(/32 Byte/)
    } finally {
      process.env.CREDENTIALS_ENCRYPTION_KEY = original
    }
  })
})
