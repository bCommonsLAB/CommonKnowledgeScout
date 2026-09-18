/**
 * @fileoverview Unit-Tests: Bericht als ZUSTAND (Wunschliste 6, Teil A) —
 * `bericht_zu_lang`, `status_zu_lang`, `bericht_ueberholt`.
 *
 * Wie bei `repo_veraltet` zaehlt vor allem, wann die Regeln SCHWEIGEN (ohne
 * Schwelle, ohne Bericht) — und dass Versionsnummern und Geldbetraege keine
 * Termine sind.
 */

import { describe, expect, it } from 'vitest'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { ArchiveRuleContext } from '@/lib/agent-view/archive-rules'
import { datumsangaben, leseNaechstenTermin, schwelleFuerRolle, statusZeilen, ueberholtePunkte } from '@/lib/agent-view/bericht-zustand'
import { checkBerichtUeberholt, checkBerichtZuLang, checkStatusZuLang } from '@/lib/agent-view/bericht-zustand-regel'

const JETZT = '2026-09-18T10:00:00.000Z'
const jetzt = new Date(JETZT)
const tag = (iso: string): number => Date.parse(`${iso}T00:00:00.000Z`)

function bericht(args: { meta?: Record<string, unknown>; body?: string; sizeBytes?: number | null }): ArchiveDocEntry {
  return {
    fileId: 'file-bericht', name: 'BERICHT.md', path: '26.05 Beispielforum/BERICHT.md', modifiedAt: JETZT,
    sizeBytes: args.sizeBytes, meta: args.meta ?? {}, body: args.body ?? '',
  }
}

function folder(doc: ArchiveDocEntry | null): ArchiveFolderNode {
  return {
    folderId: 'f-1', name: '26.05 Beispielforum', path: '4. Bereich/26.05 Beispielforum', parentFolderId: 'f-root',
    depth: 2, files: [], twinFolders: [], index: null, bericht: doc, bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null,
  }
}

function ctx(teil: Partial<ArchiveRuleContext['conventions']>): ArchiveRuleContext {
  return {
    conventions: {
      vorhabenFolderPattern: null, indexRequiredMaxDepth: null, berichtFreshness: true,
      postfachMaxRueckstandWochen: null, repoMaxRueckstandTage: null,
      berichtMaxBytes: { anwendung: null, plattform: null }, statusMaxZeilen: null, ueberholtNachTagen: null,
      ...teil,
    },
    vorhabenPattern: null, newestChangeInSubtree: null, isLibraryRoot: false, now: JETZT,
  }
}

describe('schwelleFuerRolle', () => {
  const max = { anwendung: 20000, plattform: null }
  it('waehlt je Rolle; Plattform ohne Schwelle ist aus', () => {
    expect(schwelleFuerRolle('anwendung', max)).toEqual({ schwelle: 20000, gemessenAls: 'anwendung', rolleUnbekannt: false })
    expect(schwelleFuerRolle('plattform', max)).toEqual({ schwelle: null, gemessenAls: 'plattform', rolleUnbekannt: false })
  })
  it('fehlende oder fremde Rolle misst als Anwendung und SAGT es', () => {
    expect(schwelleFuerRolle(null, max)).toMatchObject({ schwelle: 20000, rolleUnbekannt: true })
    expect(schwelleFuerRolle('—', max)).toMatchObject({ gemessenAls: 'anwendung', rolleUnbekannt: true })
  })
})

describe('bericht_zu_lang', () => {
  const scharf = ctx({ berichtMaxBytes: { anwendung: 20000, plattform: null } })
  it('schweigt ohne Schwelle, ohne Bericht, ohne bekannte Groesse und bei der Schwelle selbst', () => {
    expect(checkBerichtZuLang(folder(bericht({ sizeBytes: 69169 })), ctx({}))).toBeNull()
    expect(checkBerichtZuLang(folder(null), scharf)).toBeNull()
    expect(checkBerichtZuLang(folder(bericht({ sizeBytes: null })), scharf)).toBeNull()
    expect(checkBerichtZuLang(folder(bericht({ meta: { rolle: 'anwendung' }, sizeBytes: 20000 })), scharf)).toBeNull()
  })
  it('meldet die Groesse gegen die Schwelle der Rolle', () => {
    const gap = checkBerichtZuLang(folder(bericht({ meta: { rolle: 'anwendung' }, sizeBytes: 69169 })), scharf)
    expect(gap).toMatchObject({ type: 'bericht_zu_lang', actor: 'cowork', severity: 'warning', targetName: 'BERICHT.md' })
    expect(gap?.message).toContain('69169')
    expect(gap?.message).toContain('20000')
  })
  it('ein Plattformbericht ohne Plattform-Schwelle bleibt unbehelligt', () => {
    expect(checkBerichtZuLang(folder(bericht({ meta: { rolle: 'plattform' }, sizeBytes: 90000 })), scharf)).toBeNull()
  })
  it('ohne rolle: als Anwendung gemessen, im Detail benannt', () => {
    const gap = checkBerichtZuLang(folder(bericht({ sizeBytes: 30000 })), scharf)
    expect(gap?.detail).toContain('als Anwendung gemessen')
  })
})

describe('status_zu_lang', () => {
  const body = [
    '# Titel', '', '## Status', '', 'Zeile eins', 'Zeile zwei', '', '```', 'knowledgescout:', '  library: x', '```', '',
    'Zeile drei', '### Unterpunkt', '## Chronologie', 'gehoert nicht dazu',
  ].join('\n')
  it('zaehlt nicht-leere Zeilen ausserhalb von Codebloecken bis zur naechsten ##', () => {
    expect(statusZeilen(body)).toBe(4)
    expect(statusZeilen('# Titel\n\n## Chronologie\n')).toBeNull()
  })
  it('meldet erst UEBER der Schwelle; ohne Schwelle gar nicht', () => {
    expect(checkStatusZuLang(folder(bericht({ body })), ctx({ statusMaxZeilen: 4 }))).toBeNull()
    expect(checkStatusZuLang(folder(bericht({ body })), ctx({}))).toBeNull()
    const gap = checkStatusZuLang(folder(bericht({ body })), ctx({ statusMaxZeilen: 3 }))
    expect(gap).toMatchObject({ type: 'status_zu_lang', severity: 'info' })
    expect(gap?.message).toContain('4 Zeilen')
  })
})

describe('datumsangaben', () => {
  it('liest die drei Formen, auch ohne Schlusspunkt', () => {
    expect(datumsangaben('bis 2026-10-09 fertig', jetzt)).toEqual([tag('2026-10-09')])
    expect(datumsangaben('am 09.10.2026', jetzt)).toEqual([tag('2026-10-09')])
    expect(datumsangaben('Feature Freeze 09.10.', jetzt)).toEqual([tag('2026-10-09')])
    expect(datumsangaben('16.09 Treffen', jetzt)).toEqual([tag('2026-09-16')])
  })
  it('Versionen, Betraege und unmoegliche Tage sind keine Termine', () => {
    expect(datumsangaben('v2.5 abgegeben, 12.340 € netto, Satz 2.29.0, 45.670 €', jetzt)).toEqual([])
    expect(datumsangaben('31.02. gibt es nicht', jetzt)).toEqual([])
  })
  it('ohne Jahr zaehlt das naechstliegende', () => {
    expect(datumsangaben('10.01.', new Date('2026-12-20T00:00:00Z'))).toEqual([tag('2027-01-10')])
    expect(datumsangaben('15.12.', new Date('2027-01-05T00:00:00Z'))).toEqual([tag('2026-12-15')])
  })
})

describe('bericht_ueberholt', () => {
  const body = [
    '## Nächste Schritte', '',
    '- [ ] 16.09 Treffen Beirat',
    '- [ ] Modul entwickeln, Feature Freeze 09.10.',
    '- [x] 01.09. Angebot abgeben',
    '- [ ] 17.09–09.10 Entwicklung',
    '- [ ] Testtreffen klaeren',
    '      besprochen am 01.09.',
    '', '## Verweise', '- [ ] 01.01.2020 zaehlt hier nicht',
  ].join('\n')

  it('findet nur OFFENE Punkte im Abschnitt, deren juengstes Datum vorbei ist', () => {
    const funde = ueberholtePunkte(body, jetzt, 2)
    expect(funde.map((f) => f.zeile)).toEqual(['- [ ] 16.09 Treffen Beirat', '- [ ] Testtreffen klaeren'])
    expect(funde[0].tageVorbei).toBe(2)
  })
  it('die Schwelle gilt „ab N Tagen"', () => {
    expect(ueberholtePunkte(body, jetzt, 3).map((f) => f.zeile)).toEqual(['- [ ] Testtreffen klaeren'])
  })
  it('schweigt ohne Schwelle und ohne Funde', () => {
    expect(checkBerichtUeberholt(folder(bericht({ body })), ctx({}))).toBeNull()
    expect(checkBerichtUeberholt(folder(bericht({ body: '## Nächste Schritte\n- [ ] 22.10. Probelauf\n' })), ctx({ ueberholtNachTagen: 2 }))).toBeNull()
  })
  it('EIN Sammelbefund nennt jede Zeile woertlich', () => {
    const gap = checkBerichtUeberholt(folder(bericht({ body })), ctx({ ueberholtNachTagen: 2 }))
    expect(gap).toMatchObject({ type: 'bericht_ueberholt', actor: 'cowork', severity: 'info' })
    expect(gap?.message).toContain('2 Angabe(n)')
    expect(gap?.detail).toContain('- [ ] 16.09 Treffen Beirat')
  })
  it('naechster_termin in der Vergangenheit bzw. unlesbar ist ein Fund; heute und Zukunft nicht', () => {
    expect(leseNaechstenTermin('2026-09-18', jetzt)).toMatchObject({ art: 'gelesen', tageVorbei: 0 })
    expect(leseNaechstenTermin('2026-08', jetzt)).toMatchObject({ art: 'gelesen', tageVorbei: 18 })
    const scharf = ctx({ ueberholtNachTagen: 2 })
    expect(checkBerichtUeberholt(folder(bericht({ meta: { naechster_termin: '2026-09-16' } })), scharf)?.detail).toContain('naechster_termin: 2026-09-16')
    expect(checkBerichtUeberholt(folder(bericht({ meta: { naechster_termin: 'Mitte Oktober' } })), scharf)?.detail).toContain('nicht lesbar')
    expect(checkBerichtUeberholt(folder(bericht({ meta: { naechster_termin: '2026-10-02' } })), scharf)).toBeNull()
  })
})
