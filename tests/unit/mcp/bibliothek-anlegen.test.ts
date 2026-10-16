/**
 * Handover Library-Anlage (08.10.): `bibliothek_anlegen` baut die Library wie
 * die Oberflaeche — ohne Geheimnisse, mit eigenem Vektor-Index bei vorlageVon.
 */
import { describe, it, expect } from 'vitest'
import { bestimmeSpeicher } from '@/lib/mcp/bibliothek-anlegen'
import { baueLibrary, collectionNameFuer, uebernimmKonfiguration } from '@/lib/library-setup/entwurf'
import type { StorageConnectionSummary } from '@/types/storage-connection'
import type { Library } from '@/types/library'

const nextcloud = { typ: 'nextcloud' as const, verzeichnis: '/Archiv - Kopie' }

const zeit = '2026-10-14T00:00:00.000Z'
const kandidaten: StorageConnectionSummary[] = [
  { id: 'c1', label: 'Cloud privat', type: 'nextcloud', lastTest: null, createdAt: zeit, updatedAt: zeit },
  { id: 'c2', label: 'Firmen-OneDrive', type: 'onedrive', lastTest: null, createdAt: zeit, updatedAt: zeit },
]

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

describe('bestimmeSpeicher', () => {
  it('nimmt den Typ aus der Verbindung (per Id oder Bezeichnung)', () => {
    const perName = bestimmeSpeicher({ speicherVerbindung: 'cloud PRIVAT', verzeichnis: ' /Archiv ' }, kandidaten)
    expect(perName.verbindung?.id).toBe('c1')
    expect(perName.speicher).toEqual({ typ: 'nextcloud', verzeichnis: '/Archiv' })
    expect(bestimmeSpeicher({ speicherVerbindung: 'c2' }, kandidaten).speicher.typ).toBe('onedrive')
  })
  it('weist einen abweichenden speicherTyp und unbekannte Verbindungen ab', () => {
    expect(() => bestimmeSpeicher({ speicherVerbindung: 'c1', speicherTyp: 'onedrive' }, kandidaten)).toThrow(/passt nicht/)
    expect(() => bestimmeSpeicher({ speicherVerbindung: 'gibt es nicht' }, kandidaten)).toThrow(/nicht gefunden.*Cloud privat/)
  })
  it('ohne Verbindung: speicherTyp Pflicht, local braucht Verzeichnis, nextcloud bleibt ausstehend', () => {
    expect(() => bestimmeSpeicher({}, kandidaten)).toThrow(/speicherVerbindung/)
    expect(() => bestimmeSpeicher({ speicherTyp: 'local' }, kandidaten)).toThrow(/absoluter Pfad/)
    expect(bestimmeSpeicher({ speicherTyp: 'local', verzeichnis: 'C:/a' }, kandidaten).verbindung).toBeNull()
    expect(bestimmeSpeicher({ speicherTyp: 'nextcloud' }, kandidaten)).toEqual({ speicher: { typ: 'nextcloud', verzeichnis: undefined }, verbindung: null })
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
