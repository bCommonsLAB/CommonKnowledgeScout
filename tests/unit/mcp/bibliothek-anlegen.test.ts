/**
 * Handover Library-Anlage (08.10.): `bibliothek_anlegen` baut die Library wie
 * die Oberflaeche — ohne Geheimnisse, mit eigenem Vektor-Index bei vorlageVon.
 */
import { describe, it, expect } from 'vitest'
import { baueLibrary, collectionNameFuer, findePassendeVerbindung, geheimnisFehlt, pruefeSpeicher, uebernimmKonfiguration } from '@/lib/mcp/bibliothek-anlegen'
import type { Library } from '@/types/library'

const nextcloud = { typ: 'nextcloud' as const, verzeichnis: '/Archiv - Kopie', webdavUrl: 'https://cloud.example.org/remote.php/dav/files/u', benutzer: 'u' }

const vorlage = {
  id: 'alt', label: 'Alt', path: '/Archiv', type: 'nextcloud', isEnabled: true, transcription: 'shadowTwin',
  config: {
    nextcloud: { webdavUrl: 'https://x', username: 'u', appPassword: 'GEHEIM' },
    secretaryService: { apiUrl: 'https://s', apiKey: 'GEHEIM', template: 'vortrag-session-de', targetLanguage: 'de' },
    publicPublishing: { slugName: 'alt', isPublic: true },
    transcriptionSpeakerMode: true,
    chat: {
      targetLanguage: 'de',
      vectorStore: { collectionName: 'doc_meta__alt', indexName: 'x', indexOverride: 'y' },
      gallery: { detailViewType: 'session', facets: [{ metaKey: 'event' }] },
    },
  },
} as unknown as Library

describe('pruefeSpeicher', () => {
  it('verlangt fuer nextcloud URL und Benutzer', () => {
    expect(() => pruefeSpeicher({ typ: 'nextcloud', verzeichnis: '/a' })).toThrow(/webdavUrl/)
    expect(() => pruefeSpeicher({ ...nextcloud, benutzer: '' })).toThrow(/benutzer/)
    expect(() => pruefeSpeicher(nextcloud)).not.toThrow()
  })
  it('weist nextcloud-Angaben bei local ab', () => {
    expect(() => pruefeSpeicher({ typ: 'local', verzeichnis: 'C:/a', benutzer: 'u' })).toThrow(/nur fuer nextcloud/)
  })
  it('kennt, welche Typen ein Geheimnis brauchen', () => {
    expect(geheimnisFehlt(nextcloud)).toBe(true)
    expect(geheimnisFehlt({ typ: 'local', verzeichnis: 'C:/a' })).toBe(false)
  })
})

describe('uebernimmKonfiguration', () => {
  const { config, uebernommen } = uebernimmKonfiguration(vorlage, 'neu-1')

  it('nimmt keine Geheimnisse und keine Veroeffentlichung mit', () => {
    const text = JSON.stringify(config)
    expect(text).not.toContain('GEHEIM')
    expect(config.nextcloud).toBeUndefined()
    expect(config.publicPublishing).toBeUndefined()
  })
  it('gibt dem Vektor-Store einen eigenen Namen und entfernt Alt-Felder', () => {
    const chat = config.chat as { vectorStore: Record<string, unknown> }
    expect(chat.vectorStore).toEqual({ collectionName: collectionNameFuer('neu-1') })
  })
  it('uebernimmt Verarbeitung ohne Verbindung und die Schalter', () => {
    expect(config.secretaryService).toEqual({ template: 'vortrag-session-de', targetLanguage: 'de' })
    expect(config.transcriptionSpeakerMode).toBe(true)
    expect(uebernommen.length).toBe(3)
  })
  it('veraendert die Vorlage-Library nicht', () => {
    expect(vorlage.config?.chat?.vectorStore?.collectionName).toBe('doc_meta__alt')
  })
})

describe('baueLibrary', () => {
  it('setzt Typ, Pfad, Verbindung (ohne Zugangsdaten in der Config) und Shadow-Twin v2', () => {
    const lib = baueLibrary({ id: 'n', name: ' Neu ', inhaltstyp: 'session', speicher: nextcloud, storageConnectionId: 'c1' })
    expect(lib).toMatchObject({ id: 'n', label: 'Neu', path: '/Archiv - Kopie', type: 'nextcloud', isEnabled: true, storageConnectionId: 'c1' })
    expect((lib.config as Record<string, unknown>).nextcloud).toBeUndefined()
    expect(baueLibrary({ id: 'n', name: 'Neu', inhaltstyp: 'session', speicher: nextcloud }).storageConnectionId).toBeUndefined()
    expect(lib.config?.chat?.gallery?.detailViewType).toBe('session')
    expect(lib.config?.shadowTwin).toMatchObject({ mode: 'v2', primaryStore: 'mongo' })
  })
  it('behaelt bei Uebernahme die Facetten und setzt den gewaehlten Typ', () => {
    const lib = baueLibrary({ id: 'n', name: 'Neu', inhaltstyp: 'book', speicher: nextcloud, uebernahme: uebernimmKonfiguration(vorlage, 'n') })
    expect(lib.config?.chat?.gallery).toMatchObject({ detailViewType: 'book', facets: [{ metaKey: 'event' }] })
  })
})

describe('findePassendeVerbindung', () => {
  const kandidaten = [
    { id: 'c1', label: 'Andere', type: 'nextcloud', nextcloud: { webdavUrl: 'https://andere.example/remote.php/dav/files/u', username: 'u' } },
    { id: 'c2', label: 'Passt', type: 'nextcloud', nextcloud: { webdavUrl: 'https://CLOUD.example.org/remote.php/dav/files/u/', username: 'U' } },
    { id: 'c3', label: 'OneDrive', type: 'onedrive' },
  ]
  it('findet die Nextcloud-Verbindung mit gleicher URL und gleichem Benutzer (ohne Gross-/Kleinschreibung, ohne Schluss-Slash)', () => {
    expect(findePassendeVerbindung(nextcloud, kandidaten)?.id).toBe('c2')
  })
  it('liefert null ohne Treffer und immer bei OneDrive', () => {
    expect(findePassendeVerbindung({ ...nextcloud, benutzer: 'x' }, kandidaten)).toBeNull()
    expect(findePassendeVerbindung({ typ: 'onedrive' }, kandidaten)).toBeNull()
  })
})
