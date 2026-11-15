/**
 * @fileoverview Unit-Tests R3: Sichten, Filter, Gruppen und Texte des Reiters „Sitzungen".
 */

import { describe, it, expect } from 'vitest'
import {
  AUFFAELLIG_GRUENDE, auffaelligGruende, filtereReiter, inSicht, sortiereReiter, suchePasst, zaehleSichten,
} from '@/lib/agent-view/sitzungen-register/reiter-sicht'
import {
  BEREICH_UNBEKANNT, NICHT_BESTIMMT, OHNE_VORHABEN, bereichJeVorhaben, gruppiere,
} from '@/lib/agent-view/sitzungen-register/reiter-gruppen'
import { leseZugbereiche, warum, zeilenDatum, zeitraumText } from '@/lib/agent-view/sitzungen-register/reiter-texte'
import { HINWEIS_CODES, type SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

const JETZT = new Date('2026-11-15T12:00:00.000Z')

function sicht(o: Partial<SitzungsSicht> = {}): SitzungsSicht {
  return {
    registerId: 'r', sitzungId: null, kennung: 'keine', quelle: 'chat', titel: 'T', beginn: '2026-11-01', ende: null, link: null,
    repo: null, branch: null, prs: [], stand: 'gemeldet', hinweise: [], imBericht: false, berichtet: { chronikAm: null, blockAm: null },
    entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [], vorhabenVorschlag: null, bemerkung: null,
    vorhabenPfad: null, vorhabenFolderId: null, vorhabenBestimmt: false, belegOrdnerPfad: null, belege: [], gemeldetVon: 'import',
    gemeldetAm: '2026-11-15T10:00:00.000Z', gespeichert: true, ...o,
  }
}

const KS = { vorhabenBestimmt: true, vorhabenPfad: '6. Lab/24.09 KnowledgeScout', vorhabenFolderId: 'v-ks', belegOrdnerPfad: '6. Lab/24.09 KnowledgeScout' }

describe('Sichten und Filter', () => {
  const zeilen = [
    sicht({ registerId: 'a', stand: 'berichtet', quelle: 'code_lokal', branch: 'claude/chat-history' }),
    sicht({ registerId: 'b', stand: 'uebersprungen', quelle: 'cowork' }),
    sicht({ registerId: 'c', stand: 'notiz', quelle: 'code_cloud', hinweise: [{ code: 'doppelt', text: 'x' }] }),
    sicht({ registerId: 'd', stand: 'gemeldet', quelle: null, beginn: null, gemeldetAm: '2026-11-01T00:00:00.000Z' }),
  ]

  it('Offen = weder berichtet noch uebersprungen; auffaellig mit Hinweis oder alt gemeldet', () => {
    expect(zaehleSichten(zeilen, JETZT)).toEqual({ offen: 2, auffaellig: 2, alle: 4 })
    expect(auffaelligGruende(zeilen[3], JETZT)).toEqual(['gemeldet_ohne_beleg'])
    expect(inSicht(zeilen[0], 'offen', JETZT)).toBe(false)
  })

  it('Chip Code umfasst lokal und Cloud; Zeilen ohne Werkzeug fallen mit Chip heraus', () => {
    const ids = (w: Array<'code' | 'cowork' | 'chat'>) => filtereReiter(zeilen, { suche: '', werkzeuge: w, von: null, bis: null }, JETZT).map((z) => z.registerId)
    expect(ids(['code'])).toEqual(['a', 'c'])
    expect(ids(['cowork', 'chat'])).toEqual(['b'])
    expect(ids([])).toHaveLength(4)
  })

  it('Zeitraum laesst Zeilen ohne Beginn weg; Suche in Titel, Kennung, Branch', () => {
    expect(filtereReiter(zeilen, { suche: '', werkzeuge: [], von: '2026-10-01', bis: null }, JETZT).map((z) => z.registerId)).toEqual(['a', 'b', 'c'])
    expect(suchePasst(zeilen[0], 'CHAT-HIST')).toBe(true)
    expect(suchePasst(sicht({ registerId: 'alt:B12' }), 'b12')).toBe(true)
    expect(suchePasst(zeilen[1], 'nichts')).toBe(false)
  })

  it('aelteste zuerst haelt Zeilen ohne Datum am Ende', () => {
    const z = [sicht({ registerId: 'x', beginn: null }), sicht({ registerId: 'y', beginn: '2026-01-01' }), sicht({ registerId: 'z', beginn: '2026-05-01' })]
    expect(sortiereReiter(z, 'aelteste').map((s) => s.registerId)).toEqual(['y', 'z', 'x'])
    expect(sortiereReiter(z, 'neueste').map((s) => s.registerId)).toEqual(['z', 'y', 'x'])
  })

  it('jeder Hinweis-Code hat eine Gruppe', () => {
    for (const code of HINWEIS_CODES) expect(AUFFAELLIG_GRUENDE).toContain(code)
  })
})

describe('Gruppen', () => {
  const alle = [
    sicht({ registerId: 'k1', ...KS }),
    sicht({ registerId: 'k2', vorhabenVorschlag: { ordner: '24.09 KnowledgeScout', herkunft: 'arbeitsliste' } }),
    sicht({ registerId: 'n1', vorhabenVorschlag: { ordner: '26.10 NAS aufräumen', herkunft: 'arbeitsliste' } }),
    sicht({ registerId: 'o1', vorhabenBestimmt: true, belegOrdnerPfad: 'Organisation/Sitzungen' }),
    sicht({ registerId: 'u1' }),
  ]

  it('Bereich → Vorhaben; ein Vorschlag nimmt den Bereich nur von einem bekannten Vorhaben', () => {
    const g = gruppiere({ zeilen: alle, alle, gruppierung: 'bereich', jetzt: JETZT })
    expect(g.map((x) => x.name)).toEqual(['6. Lab', OHNE_VORHABEN, BEREICH_UNBEKANNT, NICHT_BESTIMMT])
    expect(g[0]).toMatchObject({ anzahl: 2, vorgeschlagen: 1 })
    expect(g[0].untergruppen.map((u) => [u.name, u.anzahl])).toEqual([['24.09 KnowledgeScout', 2]])
    expect(g[2].untergruppen[0]).toMatchObject({ name: '26.10 NAS aufräumen', vorgeschlagen: 1 })
    expect(g[1].zeilen.map((z) => z.registerId)).toEqual(['o1'])
  })

  it('mehrdeutiger Vorhabens-Name bekommt keinen Bereich', () => {
    const m = bereichJeVorhaben([sicht({ vorhabenPfad: 'A/X' }), sicht({ vorhabenPfad: 'B/X' }), sicht({ vorhabenPfad: 'A/Y' })])
    expect([...m]).toEqual([['Y', 'A']])
  })

  it('Hinweis-Gruppen zeigen auch leere Gruppen; Werkzeug-Gruppen nur belegte', () => {
    const h = gruppiere({ zeilen: [sicht({ hinweise: [{ code: 'beleg_ohne_vorhaben', text: '' }] })], alle, gruppierung: 'hinweis', jetzt: JETZT })
    expect(h).toHaveLength(AUFFAELLIG_GRUENDE.length)
    expect(h[0]).toMatchObject({ name: 'Beleg ohne Vorhaben', anzahl: 1 })
    expect(h.slice(1).every((g) => g.anzahl === 0)).toBe(true)
    const w = gruppiere({ zeilen: [sicht({ quelle: 'cowork' }), sicht({ quelle: null })], alle, gruppierung: 'werkzeug', jetzt: JETZT })
    expect(w.map((g) => g.name)).toEqual(['Cowork', 'Werkzeug unbekannt'])
  })
})

describe('Texte', () => {
  it('Datum knapp', () => {
    expect(zeilenDatum('2026-11-05', 2026)).toBe('05.11.')
    expect(zeilenDatum('2025-01-24', 2026)).toBe('24.01.25')
    expect(zeitraumText('2026-11-03', '2026-11-04')).toBe('03.–04.11.2026')
    expect(zeitraumText('2026-10-30', '2026-11-02')).toBe('30.10.–02.11.2026')
    expect(zeitraumText('2026-10-30', null)).toBe('30.10.2026')
    expect(zeitraumText(null, null)).toBe('ohne Datum')
  })

  it('warum: halb berichtet nennt den fehlenden Block', () => {
    const z = sicht({
      ...KS, stand: 'notiz', berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: null },
      belege: [{ sourceId: 's', parentId: 'v-ks', name: 'B.md', zuege: '1-3', notiz: true, notizAktualisiert: '2026-11-04T12:00:00.000Z' }],
    })
    const w = warum(z)
    expect(w).toMatchObject({ ton: 'offen', titel: 'Noch nicht im Bericht' })
    expect(w.text).toContain('Die Chronik SITZUNGEN.md nennt die Sitzung')
    expect(w.text).toContain('Im BERICHT.md von 24.09 KnowledgeScout fehlt der erzeugte Block.')
  })

  it('warum: uebersprungen nennt den Grund', () => {
    expect(warum(sicht({ stand: 'uebersprungen', entscheidungGrund: 'ohne Substanz' }))).toEqual({ ton: 'neutral', titel: 'Übersprungen', text: 'Grund: ohne Substanz' })
  })

  it('Zugbereiche lesen', () => {
    expect(leseZugbereiche('1-10; 11–25')).toEqual({ ok: true, bereiche: [{ von: 1, bis: 10 }, { von: 11, bis: 25 }] })
    expect(leseZugbereiche('1-10; elf')).toEqual({ ok: false, fehler: '„elf" ist kein Zugbereich (Form: 1-10)' })
    expect(leseZugbereiche('  ')).toMatchObject({ ok: false })
  })
})
