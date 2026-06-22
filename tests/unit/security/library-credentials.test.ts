/**
 * Tests fuer das Ver-/Entschluesseln der Library-Config-Secrets
 * (Encryption-at-rest am Persistenz-Rand).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  decryptLibrarySecrets,
  encryptLibrarySecrets,
} from '@/lib/security/library-credentials'
import { isEncryptedSecret } from '@/lib/security/credential-cipher'
import type { Library } from '@/types/library'

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString('base64')
})

function makeLibrary(config: Record<string, unknown>): Library {
  return {
    id: 'lib-1',
    label: 'Test',
    path: '/x',
    type: 'nextcloud',
    isEnabled: true,
    config,
  } as unknown as Library
}

const fullSecretConfig = (): Record<string, unknown> => ({
  clientSecret: 'cs-plain',
  accessToken: 'at-plain',
  refreshToken: 'rt-plain',
  nextcloud: { webdavUrl: 'https://nc', username: 'peter', appPassword: 'np-plain' },
  secretaryService: { apiUrl: 'https://sec', apiKey: 'sk-plain' },
  ingestionStorage: { containerName: 'c1', connectionString: 'cstr-plain' },
  publicPublishing: { slugName: 's', apiKey: 'pk-plain' },
})

describe('encryptLibrarySecrets', () => {
  it('verschluesselt alle bekannten Secret-Felder', () => {
    const enc = encryptLibrarySecrets(makeLibrary(fullSecretConfig()))
    const cfg = enc.config as Record<string, Record<string, string> & string>

    expect(isEncryptedSecret(cfg.clientSecret)).toBe(true)
    expect(isEncryptedSecret(cfg.accessToken)).toBe(true)
    expect(isEncryptedSecret(cfg.refreshToken)).toBe(true)
    expect(isEncryptedSecret(cfg.nextcloud.appPassword)).toBe(true)
    expect(isEncryptedSecret(cfg.secretaryService.apiKey)).toBe(true)
    expect(isEncryptedSecret(cfg.ingestionStorage.connectionString)).toBe(true)
    expect(isEncryptedSecret(cfg.publicPublishing.apiKey)).toBe(true)
  })

  it('laesst Nicht-Secret-Felder unveraendert', () => {
    const enc = encryptLibrarySecrets(makeLibrary(fullSecretConfig()))
    const cfg = enc.config as Record<string, Record<string, string>>
    expect(cfg.nextcloud.webdavUrl).toBe('https://nc')
    expect(cfg.nextcloud.username).toBe('peter')
    expect(cfg.secretaryService.apiUrl).toBe('https://sec')
    expect(cfg.ingestionStorage.containerName).toBe('c1')
    expect(cfg.publicPublishing.slugName).toBe('s')
  })

  it('mutiert die Eingabe nicht', () => {
    const input = makeLibrary(fullSecretConfig())
    encryptLibrarySecrets(input)
    const cfg = input.config as Record<string, Record<string, string> & string>
    expect(cfg.clientSecret).toBe('cs-plain')
    expect(cfg.nextcloud.appPassword).toBe('np-plain')
  })

  it('verschluesselt maskierte Sentinels NICHT', () => {
    const enc = encryptLibrarySecrets(
      makeLibrary({ clientSecret: '********', nextcloud: { appPassword: '••••abcd' } }),
    )
    const cfg = enc.config as Record<string, Record<string, string> & string>
    expect(cfg.clientSecret).toBe('********')
    expect(cfg.nextcloud.appPassword).toBe('••••abcd')
  })

  it('ist idempotent (kein Doppel-Encrypt)', () => {
    const once = encryptLibrarySecrets(makeLibrary(fullSecretConfig()))
    const twice = encryptLibrarySecrets(once)
    expect((twice.config as Record<string, string>).clientSecret).toBe(
      (once.config as Record<string, string>).clientSecret,
    )
  })

  it('kommt mit fehlender Config / fehlenden Unter-Objekten klar', () => {
    expect(() => encryptLibrarySecrets(makeLibrary({}))).not.toThrow()
    const noNested = encryptLibrarySecrets(makeLibrary({ clientSecret: 'x' }))
    expect(isEncryptedSecret((noNested.config as Record<string, string>).clientSecret)).toBe(true)
  })
})

describe('encrypt → decrypt Round-Trip', () => {
  it('stellt alle Secret-Felder als Klartext wieder her', () => {
    const enc = encryptLibrarySecrets(makeLibrary(fullSecretConfig()))
    const dec = decryptLibrarySecrets(enc)
    const cfg = dec.config as Record<string, Record<string, string> & string>

    expect(cfg.clientSecret).toBe('cs-plain')
    expect(cfg.accessToken).toBe('at-plain')
    expect(cfg.refreshToken).toBe('rt-plain')
    expect(cfg.nextcloud.appPassword).toBe('np-plain')
    expect(cfg.secretaryService.apiKey).toBe('sk-plain')
    expect(cfg.ingestionStorage.connectionString).toBe('cstr-plain')
    expect(cfg.publicPublishing.apiKey).toBe('pk-plain')
  })

  it('decrypt laesst Legacy-Klartext unveraendert', () => {
    const dec = decryptLibrarySecrets(makeLibrary({ nextcloud: { appPassword: 'legacy-plain' } }))
    expect((dec.config as Record<string, Record<string, string>>).nextcloud.appPassword).toBe(
      'legacy-plain',
    )
  })
})
