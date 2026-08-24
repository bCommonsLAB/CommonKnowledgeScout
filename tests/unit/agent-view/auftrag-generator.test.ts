import { describe, it, expect } from 'vitest'
import { buildAuftrag, renderAuftragPfad } from '@/lib/agent-view/auftrag-generator'
import { AUFTRAG_TEMPLATES, renderAuftragZeile } from '@/lib/agent-view/auftrag-templates'
import { createGap, GAP_REGISTRY } from '@/lib/agent-view/gap-registry'
import type { CoverageGapType } from '@/lib/agent-view/types'

function gap(type: CoverageGapType, path = '25.01 Pilot/BERICHT.md', detail?: string) {
  return createGap({
    type, scope: 'folder', targetId: 'id-1', targetName: 'BERICHT.md',
    folderId: 'f-1', path, message: `Befund ${type}`, detail,
  })
}

const CONTEXT = { libraryLabel: 'Onedrive Test', localRootPath: null, generatedAt: '2026-08-18T12:00:00.000Z' }

describe('auftrag-templates', () => {
  it('hat fuer JEDEN Gap-Typ der Registry eine nicht-leere Vorlage', () => {
    for (const type of Object.keys(GAP_REGISTRY) as CoverageGapType[]) {
      expect(AUFTRAG_TEMPLATES[type], type).toBeDefined()
      const zeile = renderAuftragZeile(gap(type), 'Pfad/x')
      expect(zeile.length, type).toBeGreaterThan(20)
      expect(zeile, type).toContain('Pfad/x')
    }
  })

  it('nimmt das Befund-Detail in die Aufgabenzeile auf', () => {
    const zeile = renderAuftragZeile(gap('verweis_tot', 'a/BERICHT.md', 'wikilink, Anzeigetext „x"'), 'a/BERICHT.md')
    expect(zeile).toContain('wikilink')
  })
})

describe('renderAuftragPfad', () => {
  it('rendert archiv-relativ ohne Wurzelpfad und absolut mit Wurzelpfad', () => {
    expect(renderAuftragPfad('25.01 Pilot/BERICHT.md', null)).toBe('25.01 Pilot/BERICHT.md')
    expect(renderAuftragPfad('25.01 Pilot/BERICHT.md', 'C:\\Users\\peter\\Archiv')).toBe(
      'C:\\Users\\peter\\Archiv\\25.01 Pilot\\BERICHT.md',
    )
    expect(renderAuftragPfad('a/b.md', '/mnt/archiv/')).toBe('/mnt/archiv/a/b.md')
    expect(renderAuftragPfad('', null)).toBe('(Archiv-Wurzel)')
  })
})

describe('buildAuftrag', () => {
  it('baut Kontextkopf, Aufgaben, Abschlusskriterium und Rueckmeldungsblock', () => {
    const text = buildAuftrag([gap('report_missing', '25.01 Pilot'), gap('verweis_tot')], CONTEXT)
    expect(text).toContain('# Cowork-Auftrag: Onedrive Test')
    expect(text).toContain('Coverage-Scan vom 2026-08-18T12:00:00.000Z')
    expect(text).toContain('Pflichtlektuere')
    expect(text).toContain('Twin-Datei-Contract')
    expect(text).toContain('1. [Kein Bericht]')
    expect(text).toContain('2. [Verweis ins Leere]')
    expect(text).toContain('Danach verschwinden im naechsten Scan')
    expect(text).toContain('- report_missing @ 25.01 Pilot')
    expect(text).toContain('Konsistenz-Rueckmeldung (Pflicht)')
    expect(text).toContain('widerspricht')
  })

  it('rendert absolute Pfade, wenn der lokale Wurzelpfad konfiguriert ist', () => {
    const text = buildAuftrag([gap('report_missing', '25.01 Pilot')], {
      ...CONTEXT,
      localRootPath: 'C:\\Users\\peter\\OneDrive\\Archiv',
    })
    expect(text).toContain('C:\\Users\\peter\\OneDrive\\Archiv\\25.01 Pilot')
  })

  it('wirft bei leerer Auswahl statt einen leeren Auftrag zu erzeugen', () => {
    expect(() => buildAuftrag([], CONTEXT)).toThrow(/ohne Luecken/)
  })

  it('ist deterministisch: gleiche Auswahl ⇒ identischer Text', () => {
    const auswahl = [gap('report_missing'), gap('verweis_veraltet')]
    expect(buildAuftrag(auswahl, CONTEXT)).toBe(buildAuftrag(auswahl, CONTEXT))
  })
})
