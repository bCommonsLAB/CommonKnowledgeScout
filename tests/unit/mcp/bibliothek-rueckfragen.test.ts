/**
 * C3 (Plan speicher-verbindungen-und-library-anlage): bibliothek_anlegen fragt
 * zurueck statt halb konfigurierte Libraries anzulegen — die Fragen nennen den
 * Antwortweg, bibliothek_pruefen zeigt denselben Stand fuer bestehende Libraries.
 */
import { describe, it, expect } from 'vitest'
import { baueLibrary } from '@/lib/mcp/bibliothek-anlegen'
import { alsFragen, einrichtungsSicht } from '@/lib/mcp/bibliothek-rueckfragen'
import { pruefeEinrichtung, wendeAntwortenAn } from '@/lib/library-setup/pruefung'

const URL = 'https://ks.example/settings/account/storage-connections'

describe('alsFragen', () => {
  it('nennt fuer jede offene Entscheidung Frage und Antwortweg', () => {
    const entwurf = baueLibrary({ id: 'n', name: 'Neu', speicher: { typ: 'nextcloud', verzeichnis: '/A' } })
    const fragen = alsFragen(pruefeEinrichtung(entwurf), URL)
    const nach = Object.fromEntries(fragen.map((f) => [f.schluessel, f]))
    expect(nach.inhaltstyp.antwortweg).toBe('Parameter inhaltstyp')
    expect(nach.speicher.antwortweg).toContain(URL)
    expect(nach.graph.antwortweg).toBe('entscheidungen.graph oder ueberspringen')
    expect(nach.graph.vorgabe).toBe('aus')
    expect(fragen.every((f) => f.gewicht !== 'spaeter')).toBe(true)
  })

  it('ist leer, sobald alles beantwortet oder uebersprungen ist', () => {
    const entwurf = wendeAntwortenAn(
      baueLibrary({ id: 'n', name: 'Neu', inhaltstyp: 'session', speicher: { typ: 'nextcloud', verzeichnis: '/A' }, storageConnectionId: 'c1' }),
      { facetten: 'standard', graph: true, aufnahmeSprachen: ['de'], bekannteNamen: [], antwortsprache: 'de' },
    )
    const pruefung = pruefeEinrichtung(entwurf, { uebersprungen: ['antwortregeln', 'erfassenWizards'] })
    expect(alsFragen(pruefung, URL)).toEqual([])
  })
})

describe('einrichtungsSicht', () => {
  it('zeigt „n von m" und den Status je Entscheidung', () => {
    const lib = baueLibrary({ id: 'n', name: 'Neu', inhaltstyp: 'book', speicher: { typ: 'local', verzeichnis: 'C:/a' } })
    const sicht = einrichtungsSicht(lib, {}, URL)
    expect(sicht.einrichtung).toMatch(/^\d+ von \d+$/)
    expect(sicht.pflichtOffen).toBe(false)
    expect(sicht.entscheidungen.find((e) => e.schluessel === 'name')?.status).toBe('beantwortet')
  })
})
