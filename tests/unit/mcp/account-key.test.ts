/**
 * @fileoverview Unit-Tests: signierte MCP-Account-Keys (Stufe 2).
 *
 * Roundtrip, Manipulation, falsches Secret und Format-Muell — jeweils
 * Positiv- und Negativfall. Die reine Schicht ist edge-tauglich (Web Crypto),
 * die Tests laufen mit dem globalen crypto von Node.
 */

import { describe, it, expect } from 'vitest'
import {
  buildMcpAccountKey,
  parseMcpAccountKey,
  sha256Hex,
  verifyMcpAccountKey,
} from '@/lib/mcp/account-key'

const SECRET = 'test-secret-123'
const EMAIL = 'peter.aichner@crystal-design.com'
const NONCE = '0123456789abcdef0123456789abcdef'

describe('buildMcpAccountKey + verifyMcpAccountKey', () => {
  it('Roundtrip: gebauter Key verifiziert auf den Inhaber (Positivfall)', async () => {
    const key = await buildMcpAccountKey({ userEmail: EMAIL, nonceHex: NONCE, secret: SECRET })
    expect(key.startsWith('ksm_')).toBe(true)
    expect(await verifyMcpAccountKey(key, SECRET)).toBe(EMAIL)
  })

  it('falsches Secret oder manipulierte Teile → null (Negativfall)', async () => {
    const key = await buildMcpAccountKey({ userEmail: EMAIL, nonceHex: NONCE, secret: SECRET })
    expect(await verifyMcpAccountKey(key, 'anderes-secret')).toBeNull()

    // Signatur kippen (letztes Hex-Zeichen)
    const flipped = key.slice(0, -1) + (key.endsWith('0') ? '1' : '0')
    expect(await verifyMcpAccountKey(flipped, SECRET)).toBeNull()

    // Email austauschen, Signatur behalten → Signatur passt nicht mehr
    const parsed = parseMcpAccountKey(key)
    expect(parsed?.userEmail).toBe(EMAIL)
    const other = await buildMcpAccountKey({ userEmail: 'wer@anders.de', nonceHex: NONCE, secret: SECRET })
    const otherParsed = parseMcpAccountKey(other)
    const franken = `ksm_${other.split('_')[1].split('~')[0]}~${NONCE}~${parsed?.signatureHex}`
    expect(otherParsed).not.toBeNull()
    expect(await verifyMcpAccountKey(franken, SECRET)).toBeNull()
  })

  it('Format-Muell und Legacy-Keys sind kein Account-Key (parse → null)', () => {
    expect(parseMcpAccountKey('w5-smoke-test-key-8483')).toBeNull()
    expect(parseMcpAccountKey('ksm_kaputt')).toBeNull()
    expect(parseMcpAccountKey('ksm_a~b~c')).toBeNull()
    // JWT-Form (Punkte) ist bewusst KEIN Account-Key — Clerk parst sie als Session-Token.
    expect(parseMcpAccountKey('ksm_a.b.c')).toBeNull()
    expect(parseMcpAccountKey('')).toBeNull()
  })

  it('leeres Secret: bauen wirft, verifizieren lehnt ab (kein stiller Leer-Key)', async () => {
    await expect(
      buildMcpAccountKey({ userEmail: EMAIL, nonceHex: NONCE, secret: '  ' }),
    ).rejects.toThrow('Secret')
    const key = await buildMcpAccountKey({ userEmail: EMAIL, nonceHex: NONCE, secret: SECRET })
    expect(await verifyMcpAccountKey(key, '')).toBeNull()
  })

  it('sha256Hex liefert stabiles 64-Zeichen-Hex (Speicherform)', async () => {
    const hash = await sha256Hex('abc')
    expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
