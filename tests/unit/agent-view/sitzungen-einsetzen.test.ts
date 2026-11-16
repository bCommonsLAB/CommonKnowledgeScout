/**
 * @fileoverview Unit-Tests: eine Sitzungs-Zeile in Block und Chronik einsetzen (R4b, Befund 16.11.2026).
 * Kern-Eigenschaft: Einsetzen in die Chronik von N Sitzungen ergibt dieselbe Datei wie der volle Lauf ueber N+1.
 */

import { describe, it, expect } from 'vitest'
import type { SitzungsDatensatz, VorhabenRef } from '@/lib/agent-view/sichten/sitzungen-types'
import { eintraegeFuerVorhaben } from '@/lib/agent-view/sichten/sitzungen-gruppen'
import { renderSitzungen, sitzungenBlock, sitzungsZeile } from '@/lib/agent-view/sichten/sitzungen-render'
import {
  blockZeilen, chronikGruppenLesen, fremdeQuerverweise, setzeZeileInBericht, setzeZeilenInChronik, zeilenSchluessel,
} from '@/lib/agent-view/sichten/sitzungen-einsetzen'

const NOW = new Date('2026-11-16T09:00:00.000Z')
const KS: VorhabenRef = { pfad: '6. bCommonsLab prototyping/24.09 KnowledgeScout', folderId: 'v-ks' }
const KLIMA: VorhabenRef = { pfad: '4. Ökosozialer Aktivismus/26.01 Klima', folderId: 'v-klima' }
const ARCHIV: VorhabenRef = { pfad: '10. Archiv/26.08 Archiv', folderId: 'v-ar' }

function sitzung(datum: string, titel: string, ablage: VorhabenRef | null, weitere: VorhabenRef[] = [], art: 'Code' | 'Chat' = 'Chat'): SitzungsDatensatz {
  const belegName = `${datum} ${art} ${titel}`
  return {
    datum, ende: null, titel, artWort: art, werkzeug: null, sitzungId: null,
    vorhabenPfad: ablage?.pfad ?? null, vorhabenFolderId: ablage?.folderId ?? null, belegOrdnerPfad: ablage?.pfad ?? 'Organisation/Sitzungen',
    weitereVorhaben: weitere, belegName, teaser: `${titel} erledigt.`, transformationAktualisiert: null, sourceId: `s-${belegName}`,
  }
}

const ALT = [
  sitzung('2026-11-01', 'Golden-Set fahren', KLIMA),
  sitzung('2026-11-08', 'Register planen', KS, [ARCHIV], 'Code'),
  sitzung('2026-11-10', 'Archiv aufraeumen', ARCHIV, [KS]),
  sitzung('2025-03-22', 'Habitat-Daten', null),
]

/** Wie sitzung_eintragen: Ablage-Zeile plus je Nebenvorhaben die Querverweis-Zeile. */
function eintraegeVon(s: SitzungsDatensatz) {
  return [
    { pfad: s.vorhabenPfad, zeile: sitzungsZeile({ sitzung: s, belegAnderswo: false }) },
    ...s.weitereVorhaben.map((w) => ({ pfad: w.pfad, zeile: sitzungsZeile({ sitzung: s, belegAnderswo: true }) })),
  ]
}

describe('zeilenSchluessel', () => {
  it('liest Datum und Beleg auch mit „(bis …)", „?" und Wikilinks im Teaser; Fremdzeilen → null', () => {
    expect(zeilenSchluessel('- 2026-09-15 (bis 2026-09-18) · Code · [[2026-09-15 Code X]] — siehe [[Andere]]')).toEqual({ datum: '2026-09-15', beleg: '2026-09-15 Code X' })
    expect(zeilenSchluessel('- 2026-10-01 · ? · [[2026-10-01 Notiz]]')).toEqual({ datum: '2026-10-01', beleg: '2026-10-01 Notiz' })
    expect(zeilenSchluessel('- von Hand ergaenzt')).toBeNull()
  })
})

describe('setzeZeilenInChronik', () => {
  it('Einsetzen in die Chronik von N ergibt dieselbe Datei wie der volle Lauf ueber N+1 (neues Vorhaben, Querverweis)', () => {
    const neu = sitzung('2026-11-16', 'Abschluss beschleunigt', KS, [KLIMA, { pfad: '9. Neu/26.11 Neu', folderId: 'v-neu' }])
    const r = setzeZeilenInChronik(renderSitzungen(ALT, NOW), neu.belegName, eintraegeVon(neu), NOW)
    expect(r.status).toBe('geschrieben')
    expect(r.text).toBe(renderSitzungen([...ALT, neu], NOW))
    expect(r.text).toContain('anzahl_sitzungen: 5\nanzahl_vorhaben: 4\nanzahl_querverweise: 4\n')
  })

  it('zweiter Aufruf unveraendert; geaenderter Teaser und Umzug ersetzen die alte Zeile, statt sie zu doppeln', () => {
    const neu = sitzung('2026-11-16', 'Abschluss beschleunigt', KS)
    const einmal = setzeZeilenInChronik(renderSitzungen(ALT, NOW), neu.belegName, eintraegeVon(neu), NOW).text
    expect(setzeZeilenInChronik(einmal, neu.belegName, eintraegeVon(neu), NOW)).toEqual({ text: einmal, status: 'unveraendert' })
    const umgezogen = { ...neu, vorhabenPfad: KLIMA.pfad, vorhabenFolderId: KLIMA.folderId, teaser: 'Neu formuliert.' }
    const zwei = setzeZeilenInChronik(einmal, neu.belegName, eintraegeVon(umgezogen), NOW).text
    expect(zwei).toBe(renderSitzungen([...ALT, umgezogen], NOW))
    expect(zwei.split(`[[${neu.belegName}]]`).length).toBe(2)
  })

  it('leere Chronik bekommt den ersten Abschnitt; fremde Form wirft benannt', () => {
    const neu = sitzung('2026-11-16', 'Erste', KS)
    expect(setzeZeilenInChronik(renderSitzungen([], NOW), neu.belegName, eintraegeVon(neu), NOW).text).toBe(renderSitzungen([neu], NOW))
    expect(chronikGruppenLesen(renderSitzungen(ALT, NOW)).map((g) => g.pfad)).toEqual([KLIMA.pfad, KS.pfad, ARCHIV.pfad, null])
    expect(() => setzeZeilenInChronik('# Irgendwas', neu.belegName, [], NOW)).toThrow(/voller Lauf noetig/)
    const vonHand = renderSitzungen(ALT, NOW).replace('## Ohne Vorhaben (1)\n', '## Ohne Vorhaben (1)\nvon Hand dazugeschrieben\n')
    expect(() => setzeZeilenInChronik(vonHand, neu.belegName, [], NOW)).toThrow(/unerwartete Zeile/)
  })
})

describe('setzeZeileInBericht', () => {
  const vorher = 'Kopf\n\n'
  const nachher = '\n\n## Naechste Schritte\n- [ ] etwas\n'
  const bericht = (eintraege: SitzungsDatensatz[], folderId: string, heute = '2026-11-10') =>
    `${vorher}${sitzungenBlock(eintraegeFuerVorhaben(eintraege, folderId), heute)}${nachher}`

  it('setzt die Zeile sortiert ein, behaelt Querverweise und laesst den Rest byteidentisch', () => {
    const neu = sitzung('2026-11-09', 'Dazwischen', KS)
    const r = setzeZeileInBericht(bericht(ALT, 'v-ks'), neu.belegName, sitzungsZeile({ sitzung: neu, belegAnderswo: false }), '2026-11-16')
    expect(r.status).toBe('geschrieben')
    expect(r.text).toBe(bericht([...ALT, neu], 'v-ks', '2026-11-16'))
    expect(r.text.startsWith(vorher) && r.text.endsWith(nachher)).toBe(true)
    expect(blockZeilen(r.text)?.filter((z) => z.includes('Beleg liegt in'))).toHaveLength(1)
  })

  it('gleiche Zeile: unveraendert ohne neuen Stand; ohne Marker-Block: kein_block, nichts geschrieben', () => {
    const text = bericht(ALT, 'v-ks')
    const zeile = blockZeilen(text)?.[0] ?? ''
    const beleg = zeilenSchluessel(zeile)?.beleg ?? ''
    expect(setzeZeileInBericht(text, beleg, zeile, '2026-11-16')).toEqual({ text, status: 'unveraendert', alterBlock: null })
    expect(setzeZeileInBericht('# Bericht ohne Block\n', beleg, zeile, '2026-11-16')).toEqual({ text: '# Bericht ohne Block\n', status: 'kein_block', alterBlock: null })
  })
})

describe('fremdeQuerverweise (Teilbaum-Lauf, Befund „querverweise 0")', () => {
  it('behaelt Querverweise auf Belege ausserhalb des Scopes, laesst Gesehenes und Eigenes los', () => {
    const zeilen = blockZeilen(sitzungenBlock(eintraegeFuerVorhaben(ALT, 'v-ks'), '2026-11-10')) ?? []
    const archivBeleg = ALT[2].belegName
    expect(fremdeQuerverweise(zeilen, new Set(), KS.pfad)).toEqual([zeilen.find((z) => z.includes(archivBeleg))])
    expect(fremdeQuerverweise(zeilen, new Set([archivBeleg]), KS.pfad)).toEqual([])
    // Liegt der Beleg laut Zeile im Scope, hat der Lauf ihn gesehen — fehlt er jetzt, entfaellt der Querverweis.
    expect(fremdeQuerverweise(zeilen, new Set(), '10. Archiv')).toEqual([])
  })
})
