/**
 * Seite der Verwaltungssicht: Zeile aus Hash-Gruppe, Filter „nur veraltete"
 * ueber alle Gruppen VOR dem Blaettern, strenge Parameter-Leser.
 */
import { describe, it, expect } from 'vitest'
import { baueFragenLogSeite, leseSchalter, leseZahl, zeileAusGruppe } from '@/lib/chat/verwaltung/fragen-log-sicht'
import type { FragenLogGruppe } from '@/lib/db/queries-verwaltung'
import type { AktualitaetsPruefer } from '@/lib/chat/utils/cache-aktualitaet'

function gruppe(n: number, hash: string | null): FragenLogGruppe {
  return {
    queryId: `q-${n}`, question: `Frage ${n}`, shortTitle: null, createdAt: new Date(2026, 10, 1, 12, n), status: 'ok',
    cacheHash: hash, cacheParams: hash ? { libraryId: 'lib', question: `Frage ${n}`, queryType: 'question', targetLanguage: 'de' } : null,
    cacheInvalidatedAt: n === 2 ? new Date('2026-11-09T09:00:00Z') : null, anzahlQuellen: n, anzahlEintraege: 1,
  }
}

/** veraltet fuer die Hashes h1 und h3, unbekannt ohne Hash, sonst aktuell. */
const pruefer: AktualitaetsPruefer = {
  hinweis: null,
  pruefe: async (e) => (!e.cacheHash ? 'unbekannt' : e.cacheHash === 'h1' || e.cacheHash === 'h3' ? 'veraltet' : 'aktuell'),
}

describe('zeileAusGruppe', () => {
  it('nimmt Sprache, Modell und Facetten aus cacheParams, Datum als ISO, Verworfen als ISO oder null', async () => {
    const z = await zeileAusGruppe(gruppe(2, 'h2'), pruefer)
    expect(z).toMatchObject({ queryId: 'q-2', frage: 'Frage 2', sprache: 'de', modell: null, facetten: null, aktualitaet: 'aktuell', queryType: 'question' })
    expect(z.cacheInvalidatedAt).toBe('2026-11-09T09:00:00.000Z')
    expect((await zeileAusGruppe(gruppe(1, null), pruefer)).aktualitaet).toBe('unbekannt')
  })
})

describe('baueFragenLogSeite', () => {
  const gruppen = [gruppe(1, 'h1'), gruppe(2, 'h2'), gruppe(3, 'h3'), gruppe(4, null)]

  it('blaettert ueber die Gesamtmenge', async () => {
    const s = await baueFragenLogSeite(gruppen, pruefer, { seite: 2, proSeite: 3, nurVeraltete: false })
    expect(s.gesamt).toBe(4)
    expect(s.zeilen.map((z) => z.queryId)).toEqual(['q-4'])
  })

  it('filtert „nur veraltete" vor dem Blaettern und zaehlt nur diese', async () => {
    const s = await baueFragenLogSeite(gruppen, pruefer, { seite: 1, proSeite: 25, nurVeraltete: true })
    expect(s.gesamt).toBe(2)
    expect(s.zeilen.map((z) => z.aktualitaet)).toEqual(['veraltet', 'veraltet'])
  })

  it('reicht den Hinweis des Pruefers durch', async () => {
    const kaputt: AktualitaetsPruefer = { hinweis: 'Antwortregeln kaputt', pruefe: async () => 'unbekannt' }
    expect((await baueFragenLogSeite(gruppen, kaputt, { seite: 1, proSeite: 25, nurVeraltete: false })).hinweis).toBe('Antwortregeln kaputt')
  })
})

describe('Parameter-Leser', () => {
  it('leseZahl: Vorgabe bei leer, Fehler bei 0, Bruch, Text oder ueber max', () => {
    expect(leseZahl(null, 25, 100, 'proSeite')).toBe(25)
    expect(leseZahl('10', 25, 100, 'proSeite')).toBe(10)
    for (const roh of ['0', '1.5', 'x', '101']) expect(() => leseZahl(roh, 25, 100, 'proSeite')).toThrow(/proSeite/)
  })

  it('leseSchalter: fehlt = false, sonst nur true/false', () => {
    expect(leseSchalter(null, 'nurTreffer')).toBe(false)
    expect(leseSchalter('true', 'nurTreffer')).toBe(true)
    expect(() => leseSchalter('ja', 'nurTreffer')).toThrow(/nurTreffer/)
  })
})
