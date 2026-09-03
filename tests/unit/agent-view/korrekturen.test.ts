/**
 * @fileoverview Unit-Tests: Korrekturauftraege sammeln und verdichten (K4).
 *
 * Die beiden Verdichtungsgrade von `korrekturen_lesen` sind die Antwort auf
 * einen Zielkonflikt: nicht jedes Verzeichnis einzeln pruefen muessen, aber
 * beim Arbeiten an einem Ordner auch nichts Fremdes mitgeschleppt bekommen.
 * Getestet wird beides — plus die Regel, dass ein gemeldeter Auftrag kein
 * offener mehr ist.
 */

import { describe, it, expect } from 'vitest'
import {
  AUSZUG_LAENGE,
  sammleKorrekturen,
  verdichteNachOrdner,
  type KorrekturMitPfad,
} from '@/lib/agent-view/korrekturen'
import type { KorrekturRohZeile } from '@/lib/repositories/shadow-twin-repo'

const PETER = 'human:peter@example.org'

function zeile(overrides: Partial<KorrekturRohZeile> = {}): KorrekturRohZeile {
  return {
    sourceId: 'src-1',
    sourceName: 'Aufnahme.m4a',
    parentId: 'f-bozen',
    ...overrides,
  }
}

function auftragFm(auftrag: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    korrektur_auftrag: auftrag,
    korrektur_von: PETER,
    korrektur_at: '2026-08-30T09:12:00.000Z',
    ...extra,
  }
}

describe('sammleKorrekturen', () => {
  it('findet den Auftrag am Transkript samt Artefakt-Referenz', () => {
    const auftraege = sammleKorrekturen([
      zeile({ transkript: auftragFm('Gehoert unter 26.02') }),
    ])
    expect(auftraege).toEqual([
      {
        sourceId: 'src-1',
        sourceName: 'Aufnahme.m4a',
        parentId: 'f-bozen',
        kind: 'transcript',
        templateName: null,
        targetLanguage: '',
        auftrag: 'Gehoert unter 26.02',
        von: PETER,
        at: '2026-08-30T09:12:00.000Z',
      },
    ])
  })

  it('findet Auftraege in Transformationen mit Template und Sprache', () => {
    const auftraege = sammleKorrekturen([
      zeile({
        transformationen: [
          { template: 'standard', sprachen: [{ sprache: 'de', frontmatter: auftragFm('Titel ist falsch') }] },
        ],
      }),
    ])
    expect(auftraege).toHaveLength(1)
    expect(auftraege[0]).toMatchObject({
      kind: 'transformation',
      templateName: 'standard',
      targetLanguage: 'de',
      auftrag: 'Titel ist falsch',
    })
  })

  it('zaehlt einen gemeldeten Auftrag NICHT mehr als offen', () => {
    const auftraege = sammleKorrekturen([
      zeile({
        transkript: auftragFm('Schon erledigt', { korrektur_erledigt_at: '2026-08-30T11:40:00.000Z' }),
      }),
    ])
    expect(auftraege).toEqual([])
  })

  it('ignoriert Artefakte ohne Auftrag und leere Auftragstexte', () => {
    const auftraege = sammleKorrekturen([
      zeile({ transkript: { generated_by: 'knowledgescout/whisper' } }),
      zeile({ sourceId: 'src-2', transkript: { korrektur_auftrag: '   ' } }),
    ])
    expect(auftraege).toEqual([])
  })

  it('meldet fehlende Herkunft als null statt sie zu erfinden', () => {
    const auftraege = sammleKorrekturen([
      zeile({ transkript: { korrektur_auftrag: 'Aus Alt-Bestand' } }),
    ])
    expect(auftraege[0].von).toBeNull()
    expect(auftraege[0].at).toBeNull()
  })

  it('sammelt mehrere Auftraege einer Quelle einzeln — jeder ist eine eigene Aufgabe', () => {
    const auftraege = sammleKorrekturen([
      zeile({
        transkript: auftragFm('Wortlaut korrigieren'),
        transformationen: [
          { template: 'standard', sprachen: [{ sprache: 'de', frontmatter: auftragFm('Titel ist falsch') }] },
        ],
      }),
    ])
    expect(auftraege).toHaveLength(2)
  })
})

describe('verdichteNachOrdner — die Uebersicht zum Entscheiden', () => {
  function mitPfad(overrides: Partial<KorrekturMitPfad>): KorrekturMitPfad {
    return {
      sourceId: 's', sourceName: 'a.m4a', parentId: 'f1', ordnerPfad: '25.11 Bozen',
      kind: 'transcript', templateName: null, targetLanguage: '',
      auftrag: 'Irgendwas', von: PETER, at: '2026-08-30T09:00:00.000Z',
      ...overrides,
    }
  }

  it('macht je Ordner eine Zeile und stellt die vollsten nach vorn', () => {
    const zeilen = verdichteNachOrdner([
      mitPfad({ parentId: 'f1', ordnerPfad: '25.11 Bozen' }),
      mitPfad({ parentId: 'f2', ordnerPfad: '26.02 Commoning' }),
      mitPfad({ parentId: 'f2', ordnerPfad: '26.02 Commoning' }),
      mitPfad({ parentId: 'f2', ordnerPfad: '26.02 Commoning' }),
    ])
    expect(zeilen.map((z) => [z.ordnerPfad, z.offen])).toEqual([
      ['26.02 Commoning', 3],
      ['25.11 Bozen', 1],
    ])
  })

  it('nennt den aeltesten Auftrag des Ordners — er wartet am laengsten', () => {
    const zeilen = verdichteNachOrdner([
      mitPfad({ at: '2026-08-30T09:00:00.000Z' }),
      mitPfad({ at: '2026-08-28T09:00:00.000Z' }),
    ])
    expect(zeilen[0].aeltester).toBe('2026-08-28T09:00:00.000Z')
  })

  it('kuerzt den Auszug — die Uebersicht traegt keine Volltexte', () => {
    const lang = 'x'.repeat(AUSZUG_LAENGE + 50)
    const zeilen = verdichteNachOrdner([mitPfad({ auftrag: lang })])
    expect(zeilen[0].auszug).toHaveLength(AUSZUG_LAENGE)
    expect(zeilen[0].auszug.endsWith('…')).toBe(true)
  })

  it('bricht nicht ueber undatierten Auftraegen — aeltester ist dann null', () => {
    const zeilen = verdichteNachOrdner([mitPfad({ at: null })])
    expect(zeilen[0].aeltester).toBeNull()
  })

  it('trennt Ordner nach folderId, nicht nach Pfad — der Pfad kann leer sein', () => {
    const zeilen = verdichteNachOrdner([
      mitPfad({ parentId: 'f1', ordnerPfad: '' }),
      mitPfad({ parentId: 'f2', ordnerPfad: '' }),
    ])
    expect(zeilen).toHaveLength(2)
  })
})
