/**
 * A3 (Plan speicher-verbindungen-und-library-anlage): Die Bruecke waehlt
 * Verbindungen eindeutig, zeigt nie Geheimnisse und haengt Libraries nur an
 * Verbindungen ihres Typs.
 */
import { describe, it, expect } from 'vitest'
import { pruefeZuweisung, verbindungsZeile, waehleVerbindung } from '@/lib/mcp/speicher-verbindung-wahl'
import type { Library } from '@/types/library'
import type { StorageConnectionSummary } from '@/types/storage-connection'

const zeit = '2026-10-14T00:00:00.000Z'
const nc: StorageConnectionSummary = {
  id: 'c1', label: 'Cloud', type: 'nextcloud', createdAt: zeit, updatedAt: zeit,
  lastTest: { at: zeit, ok: true, message: 'Verbunden' },
  nextcloud: { webdavUrl: 'https://cloud.example.org/remote.php/dav/files/u', username: 'u', appPasswordSet: true },
}
const od: StorageConnectionSummary = {
  id: 'c2', label: 'OneDrive', type: 'onedrive', createdAt: zeit, updatedAt: zeit, lastTest: null,
  onedrive: { tenantId: 't', clientId: 'k', clientSecretSet: true, loggedIn: false, tokenExpiry: null },
}
const doppelt: StorageConnectionSummary = { ...nc, id: 'c3' }

describe('waehleVerbindung', () => {
  it('trifft Id vor Bezeichnung, Bezeichnung ohne Gross-/Kleinschreibung', () => {
    expect(waehleVerbindung('c2', [nc, od]).id).toBe('c2')
    expect(waehleVerbindung(' onedrive ', [nc, od]).id).toBe('c2')
  })
  it('scheitert laut bei Mehrdeutigkeit, Unbekanntem und leerem Konto', () => {
    expect(() => waehleVerbindung('Cloud', [nc, doppelt])).toThrow(/mehrdeutig.*c1.*c3/)
    expect(() => waehleVerbindung('x', [nc])).toThrow(/nicht gefunden.*"Cloud"/)
    expect(() => waehleVerbindung('x', [])).toThrow(/noch keine Speicher-Verbindung/)
  })
})

describe('verbindungsZeile', () => {
  it('zeigt Kennungen, Test und Libraries — nie Geheimnisse', () => {
    const libs = [
      { id: 'l1', label: 'Archiv', storageConnectionId: 'c1' },
      { id: 'l2', label: 'Andere', storageConnectionId: 'c2' },
    ] as Library[]
    const zeile = verbindungsZeile(nc, libs)
    expect(zeile).toMatchObject({
      id: 'c1', bezeichnung: 'Cloud', typ: 'nextcloud',
      zuletztGeprueft: { am: zeit, ok: true, meldung: 'Verbunden' },
      nextcloud: { benutzer: 'u', passwortHinterlegt: true },
      libraries: [{ id: 'l1', name: 'Archiv' }],
    })
    expect(JSON.stringify(zeile)).not.toMatch(/appPassword"|clientSecret"|token/i)
    expect(verbindungsZeile(od, libs).onedrive).toEqual({ geheimnisHinterlegt: true, angemeldet: false })
  })
})

describe('pruefeZuweisung', () => {
  it('erlaubt nur gleichen Typ und keine local-Library', () => {
    expect(() => pruefeZuweisung({ label: 'A', type: 'nextcloud' }, nc)).not.toThrow()
    expect(() => pruefeZuweisung({ label: 'A', type: 'onedrive' }, nc)).toThrow(/ist nextcloud.*aber onedrive/)
    expect(() => pruefeZuweisung({ label: 'A', type: 'local' }, nc)).toThrow(/local/)
  })
})
