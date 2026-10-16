/**
 * C1: `pruefeEinrichtung` liefert offene Entscheidungen, `wendeAntwortenAn`
 * schreibt Antworten nur ueber den geprueften Antwortweg.
 */
import { describe, it, expect } from 'vitest'
import { pruefeEinrichtung, wendeAntwortenAn } from '@/lib/library-setup/pruefung'
import type { Library } from '@/types/library'

function lib(teil: Partial<Library> = {}, detailViewType?: string): Library {
  return {
    id: 'l', label: 'Neu', path: '/Archiv', type: 'nextcloud', isEnabled: true, transcription: 'shadowTwin',
    config: detailViewType ? { chat: { gallery: { detailViewType } } } : {},
    ...teil,
  } as Library
}

const offeneSchluessel = (l: Library, k = {}) => pruefeEinrichtung(l, k).offen.map((s) => s.schluessel)

describe('pruefeEinrichtung', () => {
  it('meldet fehlende Pflicht: Inhaltstyp und Verbindung', () => {
    const p = pruefeEinrichtung(lib())
    expect(p.pflichtOffen).toBe(true)
    expect(p.offen.filter((s) => s.gewicht === 'pflicht').map((s) => s.schluessel)).toEqual(['inhaltstyp', 'speicher'])
  })

  it('local braucht nur den Pfad, nextcloud die Verbindung', () => {
    expect(offeneSchluessel(lib({ type: 'local', path: 'C:/a' }, 'book'))).not.toContain('speicher')
    expect(offeneSchluessel(lib({ storageConnectionId: 'c1' }, 'book'))).not.toContain('speicher')
  })

  it('fragt Sprachen und Namen nur, wenn Audio erwartet wird (E6)', () => {
    const buch = offeneSchluessel(lib({ storageConnectionId: 'c1' }, 'book'))
    expect(buch).not.toContain('aufnahmeSprachen')
    expect(buch).not.toContain('bekannteNamen')
    const vortrag = offeneSchluessel(lib({ storageConnectionId: 'c1' }, 'session'))
    expect(vortrag).toEqual(expect.arrayContaining(['aufnahmeSprachen', 'bekannteNamen', 'erfassenWizards']))
    expect(offeneSchluessel(lib({ storageConnectionId: 'c1' }, 'book'), { audioErwartet: true })).toContain('aufnahmeSprachen')
  })

  it('fragt die Vorlage-Library nur, wenn eine gleichen Typs existiert', () => {
    const l = lib({ storageConnectionId: 'c1' }, 'book')
    expect(offeneSchluessel(l)).not.toContain('vorlageVon')
    expect(offeneSchluessel(l, { andereLibrariesGleichenTyps: 2 })).toContain('vorlageVon')
    expect(offeneSchluessel(l, { andereLibrariesGleichenTyps: 2, vorlageGewaehlt: true })).not.toContain('vorlageVon')
  })

  it('zaehlt uebersprungene als erledigt, laesst Pflicht nicht ueberspringen', () => {
    const l = lib({ storageConnectionId: 'c1' }, 'book')
    const vorher = pruefeEinrichtung(l)
    const nachher = pruefeEinrichtung(l, { uebersprungen: ['graph'] })
    expect(nachher.erledigt).toBe(vorher.erledigt + 1)
    expect(nachher.alle.find((s) => s.schluessel === 'graph')?.status).toBe('uebersprungen')
    expect(() => pruefeEinrichtung(l, { uebersprungen: ['name'] })).toThrow(/Pflicht/)
  })

  it('ist vollstaendig, wenn Pflicht und Empfohlen beantwortet sind; „spaeter" zaehlt nicht', () => {
    const l = wendeAntwortenAn(lib({ storageConnectionId: 'c1' }, 'book'), {
      facetten: 'standard', graph: false, antwortsprache: 'de', antwortregeln: 'Antworte knapp.',
    })
    const p = pruefeEinrichtung(l)
    expect(p.offen).toEqual([])
    expect(p.vollstaendig).toBe(true)
    expect(p.gesamt).toBe(p.erledigt)
    expect(p.alle.some((s) => s.gewicht === 'spaeter' && s.status === 'offen')).toBe(true)
  })
})

describe('wendeAntwortenAn', () => {
  const basis = lib({ storageConnectionId: 'c1' }, 'session')

  it('schreibt Antworten an die Feldpfade des Katalogs', () => {
    const l = wendeAntwortenAn(basis, { graph: true, aufnahmeSprachen: ['de', 'it'], bekannteNamen: ['Bozen'], antwortsprache: 'de' })
    expect(l.config?.chat?.gallery?.graph?.enabled).toBe(true)
    expect(l.config?.chat?.gallery?.detailViewType).toBe('session')
    expect(l.config?.transcriptionLanguages).toEqual(['de', 'it'])
    expect(l.config?.extractionKnownNames).toEqual(['Bozen'])
    expect(l.config?.chat?.targetLanguage).toBe('de')
  })

  it('setzt Standard-Facetten vor Antwortregeln, deren Platzhalter darauf zeigen', () => {
    const l = wendeAntwortenAn(basis, { antwortregeln: 'Nenne {{facette:event}}.', facetten: 'standard' })
    expect(l.config?.chat?.antwortregeln).toBe('Nenne {{facette:event}}.')
    expect(() => wendeAntwortenAn(basis, { antwortregeln: 'Nenne {{facette:gibtsnicht}}.' })).toThrow(/gibtsnicht/)
  })

  it('weist ungueltige, unbekannte und nicht beantwortbare Antworten laut ab', () => {
    expect(() => wendeAntwortenAn(basis, { graph: 'ja' })).toThrow(/graph.*ungueltig/)
    expect(() => wendeAntwortenAn(basis, { aufnahmeSprachen: ['Deutsch'] })).toThrow(/ISO-Code/)
    expect(() => wendeAntwortenAn(basis, { gibtsnicht: 1 })).toThrow(/Unbekannte Entscheidung/)
    expect(() => wendeAntwortenAn(basis, { erfassenWizards: [] })).toThrow(/Settings/)
    expect(() => wendeAntwortenAn(basis, { name: 'x' })).toThrow(/eigener Parameter/)
  })
})
