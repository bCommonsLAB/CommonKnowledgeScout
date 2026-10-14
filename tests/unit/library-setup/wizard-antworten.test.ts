/**
 * C2 (Plan speicher-verbindungen-und-library-anlage): Antworten des
 * Anlege-Wizards werden ueber dieselben Bausteine wie die Bruecke zur Library;
 * Leeres bleibt offen, nichts wird still vorbelegt.
 */
import { describe, it, expect } from 'vitest'
import { LEERE_ANTWORTEN, baueWizardEntwurf, katalogAntworten, type WizardAntworten } from '@/lib/library-setup/wizard-antworten'

const vorhanden = [
  { id: 'alt', label: 'Alt', config: { chat: { gallery: { detailViewType: 'session', facets: [{ metaKey: 'event' }] }, vectorStore: { collectionName: 'doc_meta__alt' } }, nextcloud: { appPassword: 'GEHEIM' } } },
  { id: 'buch', label: 'Buch', config: { chat: { gallery: { detailViewType: 'book' } } } },
]

const antworten = (teil: Partial<WizardAntworten>): WizardAntworten => ({ ...LEERE_ANTWORTEN, ...teil })

describe('katalogAntworten', () => {
  it('liefert nur Beantwortetes und zerlegt Listen', () => {
    expect(katalogAntworten(LEERE_ANTWORTEN)).toEqual({})
    expect(katalogAntworten(antworten({ aufnahmeSprachen: 'DE, it;en', bekannteNamen: 'Bozen\n\n Meran ', graph: false }))).toEqual({
      aufnahmeSprachen: ['de', 'it', 'en'], bekannteNamen: ['Bozen', 'Meran'], graph: false,
    })
  })
})

describe('baueWizardEntwurf', () => {
  it('leerer Wizard: Pflicht offen, nichts vorbelegt', () => {
    const { pruefung, library } = baueWizardEntwurf('n', LEERE_ANTWORTEN, vorhanden)
    expect(pruefung.pflichtOffen).toBe(true)
    expect(pruefung.offen.map((s) => s.schluessel)).toEqual(expect.arrayContaining(['name', 'inhaltstyp', 'speicher']))
    expect(library.config?.chat?.gallery?.detailViewType).toBeUndefined()
  })

  it('Pflicht beantwortet: anlegbar, Empfohlenes bleibt sichtbar offen', () => {
    const { pruefung, library } = baueWizardEntwurf('n', antworten({ name: 'Neu', inhaltstyp: 'book', verbindungId: 'c1', verzeichnis: '/A' }), vorhanden)
    expect(pruefung.pflichtOffen).toBe(false)
    expect(library).toMatchObject({ type: 'nextcloud', path: '/A', storageConnectionId: 'c1' })
    expect(pruefung.offen.map((s) => s.schluessel)).toEqual(expect.arrayContaining(['vorlageVon', 'facetten', 'graph']))
  })

  it('Vorlage-Library: uebernimmt Konfiguration ohne Geheimnisse, eigener Vektor-Index', () => {
    const { library, kontext, pruefung } = baueWizardEntwurf('neu', antworten({ name: 'Neu', inhaltstyp: 'session', vorlageVon: 'alt', speicherTyp: 'local', verzeichnis: '/x' }), vorhanden)
    expect(kontext).toMatchObject({ vorlageGewaehlt: true, andereLibrariesGleichenTyps: 1 })
    expect(library.config?.chat?.gallery?.facets).toEqual([{ metaKey: 'event' }])
    expect(library.config?.chat?.vectorStore?.collectionName).toBe('doc_meta__neu')
    expect(JSON.stringify(library)).not.toContain('GEHEIM')
    expect(pruefung.alle.find((s) => s.schluessel === 'facetten')?.status).toBe('beantwortet')
  })

  it('local ignoriert eine gewaehlte Verbindung', () => {
    const { library } = baueWizardEntwurf('n', antworten({ name: 'Neu', inhaltstyp: 'book', speicherTyp: 'local', verbindungId: 'c1', verzeichnis: '/x' }), vorhanden)
    expect(library.storageConnectionId).toBeUndefined()
  })

  it('wirft bei ungueltigen Antworten und unbekannter Vorlage', () => {
    expect(() => baueWizardEntwurf('n', antworten({ inhaltstyp: 'book', aufnahmeSprachen: 'Deutsch' }), vorhanden)).toThrow(/ISO-Code/)
    expect(() => baueWizardEntwurf('n', antworten({ vorlageVon: 'weg' }), vorhanden)).toThrow(/nicht gefunden/)
  })
})
