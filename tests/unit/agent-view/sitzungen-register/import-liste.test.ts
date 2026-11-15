/**
 * @fileoverview Unit-Tests R2: Arbeitsliste parsen und Zeilen deuten.
 * Die Zeilen sind gekuerzte Abbilder der echten Liste (Form seit 08.11.2026).
 */

import { describe, it, expect } from 'vitest'
import { parseArbeitsliste, zellen } from '@/lib/agent-view/sitzungen-register/import/arbeitsliste-parsen'
import { leseListenzeile } from '@/lib/agent-view/sitzungen-register/import/listenzeile-lesen'
import { KOPF, LISTE } from './import-fixtures'

describe('parseArbeitsliste', () => {
  it('liest nur den Bereich „Sitzungen nach Vorhaben", je Zeile mit Abschnitt', () => {
    const p = parseArbeitsliste(LISTE)
    expect(p.fehler).toEqual([])
    expect(p.abschnitte).toEqual([
      '4. Ökosozialer Aktivismus/24.03 bcoop', '4. Ökosozialer Aktivismus/24.05 Konferenzen und Netzwerk',
      '6. bCommonsLab prototyping/24.09 KnowledgeScout', 'Ohne Zuordnung',
    ])
    expect(p.zeilen.map((z) => z.nr)).toEqual(['A66', 'B82', 'B17', 'C4', 'D93', 'B41'])
    expect(p.zeilen[0]).toMatchObject({ erledigt: true, beginn: '2026-09-15', ende: '2026-09-18', quelleRoh: 'Code lokal' })
    expect(p.zeilen[5]).toMatchObject({ erledigt: false, beginn: '2026-10-12', beginnGeschaetzt: true, ende: null })
  })

  it('meldet kaputte Zeilen mit Zeilennummer statt sie zu ueberspringen', () => {
    const p = parseArbeitsliste(['## Sitzungen nach Vorhaben', '### X/Y (1, davon 0 abgeschlossen)', KOPF,
      '| [?] | B1 | 2026-01-01 |  | T | Chat 2024/25 |  |  |', '| [ ] | Z9 | 2026-01-01 |  | T | Chat 2024/25 |  |  |',
      '| [ ] | B2 | 1.1.2026 |  | T | Chat 2024/25 |  |  |', '| [ ] | B3 | 2026-01-01 |  | T |'].join('\n'))
    expect(p.zeilen).toEqual([])
    expect(p.fehler.map((f) => f.zeile)).toEqual([5, 6, 7, 8])
  })

  it('zellen: Rand-Pipes weg, \\| bleibt im Text', () => {
    expect(zellen('| a | b \\| c |  |')).toEqual(['a', 'b | c', ''])
  })
})

describe('leseListenzeile', () => {
  const [a66, b82, b17, c4, d93, b41] = parseArbeitsliste(LISTE).zeilen.map(leseListenzeile)

  it('Teil A: Verweis, Repo, Branch, PR, Vorhaben aus dem Abschnitt', () => {
    expect(a66).toMatchObject({
      quelle: 'code_lokal', belegVerweis: '2026-09-15 Projektheft-Wiki, bcoop-Logo und QR-Fix', erledigtAm: '2026-11-05',
      repo: 'bcoop-notion2wiki', branch: 'feature/bcoop-logo-svg', prs: ['bcoop-notion2wiki#9'], vorhaben: '24.03 bcoop', exportPraefix: null,
    })
  })

  it('Teil B: Kuerzel, Vorhaben aus der Bemerkung samt Nebenvorhaben', () => {
    expect(b17).toMatchObject({ exportPraefix: '36a7ce26', vorhaben: '24.05 Konferenzen und Netzwerk', nebenvorhaben: ['24.02 Commoning mit der Uni Marburg'] })
    expect(b82).toMatchObject({ exportPraefix: null, belegVerweis: null, vorhaben: '24.03 bcoop', bemerkung: '' })
  })

  it('Teil B: mit Export-Vermerk claude.ai-Chat, ohne Vermerk Cowork (Nachtrag 08.11.)', () => {
    expect(b17.quelle).toBe('chat')
    expect(b82.quelle).toBe('cowork')
    expect(b41.quelle).toBe('cowork')
  })

  it('Teil C: überspringen mit Grund', () => {
    expect(c4).toMatchObject({ ueberspringenGrund: '1 Zug („Weiter“), Fortsetzung ohne Inhalt', belegVerweis: null })
  })

  it('Teil D: volle Kennung und Link aus dem Sitzungs-Link, PR aus der Bemerkung', () => {
    expect(d93).toMatchObject({
      quelle: 'code_cloud', kennungAusLink: 'session_01N8C1k45v7euqTxNaNhayrh', repo: 'CommonKnowledgeScout',
      link: 'https://claude.ai/code/session_01N8C1k45v7euqTxNaNhayrh', prs: ['https://github.com/bCommonsLAB/CommonKnowledgeScout/pull/62'],
    })
  })

  it('Ohne Zuordnung: kein Vorhaben; Notiz vorhanden wird gelesen', () => {
    expect(b41).toMatchObject({ vorhaben: null, notizVorhanden: '2026-10-12 Einladung Marburg' })
  })

  it('unbekannte Quelle ist ein Fehler', () => {
    const [z] = parseArbeitsliste(['## Sitzungen nach Vorhaben', '### X/Y', KOPF, '| [ ] | B1 | 2026-01-01 |  | T | Fax |  |  |'].join('\n')).zeilen
    expect(() => leseListenzeile(z)).toThrow(/unbekannte Quelle „Fax"/)
  })
})
