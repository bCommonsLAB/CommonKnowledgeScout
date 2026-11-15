/**
 * @fileoverview Unit-Tests R2: Zuordnung der Listenzeilen und Import-Plan (idempotent, fuellt nur).
 */

import { describe, it, expect } from 'vitest'
import { parseArbeitsliste } from '@/lib/agent-view/sitzungen-register/import/arbeitsliste-parsen'
import { bilanzDesImports } from '@/lib/agent-view/sitzungen-register/import/import-dienst'
import { planeImport } from '@/lib/agent-view/sitzungen-register/import/import-planen'
import { namensSchluessel } from '@/lib/agent-view/sitzungen-register/import/import-zuordnen'
import type { SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'
import { JETZT, LIB, beleg, doc } from './fixtures'
import { LISTE } from './import-fixtures'

const K_A66 = 'aaaa1111-2222-4333-8444-555566667777'
const K_B17 = '36a7ce26-0000-4000-8000-000000000017'
const BELEG_A66 = beleg({ sourceId: 's-a66', name: '2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix.md', kopfKennung: K_A66, notizKennung: K_A66 })
const BELEG_B17 = beleg({ sourceId: 's-b17', name: '2026-10-24 Chat Dokument aus Projektordner ausfüllen.md', kopfKennung: K_B17, notizKennung: K_B17, werkzeug: 'chat' })
const DOC_A66 = doc({ registerId: K_A66, sitzungId: K_A66, gemeldetVon: 'archiv', titelOriginal: 'Projektheft-Wiki, bcoop-Logo und QR-Fix', belegSourceIds: ['s-a66'], repo: null })
const DOC_B17 = doc({ registerId: K_B17, sitzungId: K_B17, quelle: 'chat', gemeldetVon: 'archiv', belegSourceIds: ['s-b17'], vorhabenVorschlag: { ordner: 'X', herkunft: 'owner' } })
const DOC_OHNE = doc({ registerId: 'nur-archiv-1234567890', sitzungId: 'nur-archiv-1234567890', gemeldetVon: 'archiv', belegSourceIds: ['s-x'], titelOriginal: 'Nur im Archiv' })

const plane = (docs: SitzungsRegisterDoc[]) =>
  planeImport({ libraryId: LIB, zeilen: parseArbeitsliste(LISTE).zeilen, docs, belege: [BELEG_A66, BELEG_B17], jetzt: JETZT })

describe('namensSchluessel', () => {
  it('Beleg-Name und Notiz-Verweis treffen sich ohne Art-Wort und .md', () => {
    expect(namensSchluessel('2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix.md')).toBe(namensSchluessel('2026-09-15 Projektheft-Wiki, bcoop-Logo und QR-Fix'))
  })
})

describe('planeImport', () => {
  const plan = plane([DOC_A66, DOC_B17, DOC_OHNE])
  const zeile = (nr: string) => plan.zeilen.find((z) => z.nr === nr)

  it('Wege: Verweis (A), Verweis vor Kuerzel (B17), Link (D), sonst alt:<Nr>', () => {
    expect(zeile('A66')).toMatchObject({ weg: 'verweis', registerId: K_A66, aktion: 'ergaenzt' })
    expect(zeile('B17')).toMatchObject({ weg: 'verweis', registerId: K_B17 })
    expect(zeile('D93')).toMatchObject({ weg: 'link', registerId: 'session_01N8C1k45v7euqTxNaNhayrh', aktion: 'neu' })
    expect(zeile('B82')).toMatchObject({ weg: 'alt', registerId: 'alt:B82', aktion: 'neu' })
    expect(zeile('C4')).toMatchObject({ weg: 'alt', registerId: 'alt:C4' })
  })

  it('fuellt nur Fehlendes; ein gepflegter Vorschlag bleibt', () => {
    const a66 = plan.aenderungen.find((a) => a.registerId === K_A66)?.set
    expect(a66).toMatchObject({ nrAlt: 'A66', repo: 'bcoop-notion2wiki', branch: 'feature/bcoop-logo-svg', vorhabenVorschlag: { ordner: '24.03 bcoop', herkunft: 'arbeitsliste' } })
    expect(a66?.titelOriginal).toBeUndefined()
    const b17 = plan.aenderungen.find((a) => a.registerId === K_B17)?.set
    expect(b17?.vorhabenVorschlag).toBeUndefined()
  })

  it('neue Zeilen: D mit voller Kennung und code_cloud, C4 uebersprungen mit Kuerzel, B41 mit Notiz-Kopie', () => {
    const neu = (rid: string) => plan.neu.find((d) => d.registerId === rid)
    expect(neu('session_01N8C1k45v7euqTxNaNhayrh')).toMatchObject({ sitzungId: 'session_01N8C1k45v7euqTxNaNhayrh', kennung: 'voll', quelle: 'code_cloud', gemeldetVon: 'import', nrAlt: 'D93' })
    expect(neu('alt:C4')).toMatchObject({ kennung: 'praefix', kennungPraefix: 'aade4646', entscheidung: 'ueberspringen', entscheidungGrund: '1 Zug („Weiter“), Fortsetzung ohne Inhalt' })
    expect(neu('alt:B41')).toMatchObject({ kennung: 'keine', altNotizPfad: 'Organisation/Sitzungen/2026-10-12 Einladung Marburg.md', vorhabenVorschlag: null, beginn: '2026-10-12' })
  })

  it('Belege ohne Listenzeile werden genannt', () => {
    expect(plan.belegeOhneZeile).toEqual(['nur-archiv-1234567890 · Nur im Archiv'])
  })

  it('zweiter Lauf auf dem Ergebnis aendert nichts', () => {
    const nachher = [DOC_OHNE, ...plan.neu, ...[DOC_A66, DOC_B17].map((d) => ({ ...d, ...(plan.aenderungen.find((a) => a.registerId === d.registerId)?.set ?? {}) }))]
    const zweiter = plane(nachher as SitzungsRegisterDoc[])
    expect(zweiter.neu).toEqual([])
    expect(zweiter.aenderungen).toEqual([])
    expect(zweiter.zeilen.every((z) => z.aktion === 'unveraendert')).toBe(true)
  })

  it('erledigt ohne gefundenen Beleg wird Hinweis', () => {
    const ohneBelege = planeImport({ libraryId: LIB, zeilen: parseArbeitsliste(LISTE).zeilen, docs: [], belege: [], jetzt: JETZT })
    expect(ohneBelege.zeilen.find((z) => z.nr === 'A66')?.hinweise).toEqual([
      'Verweis [[2026-09-15 Projektheft-Wiki, bcoop-Logo und QR-Fix]]: kein Beleg mit Notiz gefunden',
      'erledigt, aber kein Beleg mit Notiz gefunden',
    ])
  })

  it('Bilanz je Teil', () => {
    const b = bilanzDesImports(plan.zeilen)
    expect(b.jeTeil.B).toEqual({ zeilen: 3, erledigt: 1, offen: 2, uebersprungen: 0 })
    expect(b.jeTeil.C).toEqual({ zeilen: 1, erledigt: 1, offen: 0, uebersprungen: 1 })
    expect(b.zeilen).toBe(6)
  })
})
