import { describe, expect, it } from 'vitest'
import { MAX_PLAYLIST_STAPEL, bereinigeOrdnername, ordnerVorschlag, planePlaylistAnlage } from '@/lib/web-source/playlist-auswahl'
import type { PlaylistEintrag } from '@/lib/web-source/playlist-resolve'

function eintrag(position: number, title: string, grund: string | null = null): PlaylistEintrag {
  return { position, id: `id${position}`, url: `https://www.youtube.com/watch?v=id${position}`, title, duration: null, grund }
}

const ENTRIES = [eintrag(1, 'Abend 1: Aufbruch?'), eintrag(2, 'Abend 2 / Rueckblick'), eintrag(3, 'Abend 3', 'privat')]

describe('bereinigeOrdnername / ordnerVorschlag (Welle K3)', () => {
  it('entfernt verbotene Zeichen, zieht Leerraum zusammen, kuerzt an der Wortgrenze', () => {
    expect(bereinigeOrdnername('  Abend 1: Aufbruch?  ')).toBe('Abend 1 Aufbruch')
    expect(bereinigeOrdnername('A / B | C "D"')).toBe('A B C D')
    expect(bereinigeOrdnername('Ende mit Punkt...')).toBe('Ende mit Punkt')
    const lang = bereinigeOrdnername('wort '.repeat(40))
    expect(lang.length).toBeLessThanOrEqual(80)
    expect(lang.endsWith('wort')).toBe(true)
  })

  it('NN Titel nach Position, dreistellig ab 100, JJJJ-MM-TT Titel mit Datum', () => {
    expect(ordnerVorschlag(7, 'Abend 7')).toBe('07 Abend 7')
    expect(ordnerVorschlag(100, 'Abend 100')).toBe('100 Abend 100')
    expect(ordnerVorschlag(7, 'Abend 7', '2015-11-09')).toBe('2015-11-09 Abend 7')
    expect(ordnerVorschlag(4, '???')).toBe('04 Video 4')
  })
})

describe('planePlaylistAnlage', () => {
  it('plant je Auswahl eine Zeile; vorhandene Ordner und private Eintraege werden Befund, nicht ueberschrieben oder verschwiegen', () => {
    const plan = planePlaylistAnlage({ entries: ENTRIES, auswahl: [1, 'id2', 3, 9], vorhandeneNamen: ['02 Abend 2 Rueckblick'] })
    expect(plan.map((z) => z.ordner)).toEqual(['01 Abend 1 Aufbruch', '02 Abend 2 Rueckblick', '03 Abend 3', ''])
    expect(plan[0].befund).toBeNull()
    expect(plan[1].befund).toMatch(/gibt es unter der Wurzel schon — nicht ueberschrieben/)
    expect(plan[2].befund).toBe('nicht abrufbar: privat')
    expect(plan[3].befund).toBe('Position 9 ist nicht in der Playlist')
  })

  it('ordnernamen ueberstimmen den Vorschlag (bereinigt); doppelte Namen in der Auswahl sind ein Befund', () => {
    const plan = planePlaylistAnlage({ entries: ENTRIES, auswahl: [1, 2], ordnernamen: { '1': '2015-11-09 Auftakt:', '2': '2015-11-09 auftakt' }, vorhandeneNamen: [] })
    expect(plan[0].ordner).toBe('2015-11-09 Auftakt')
    expect(plan[0].befund).toBeNull()
    expect(plan[1].befund).toMatch(/doppelt/)
  })

  it('mehr als die Stapelgrenze ist eine Absage mit Hinweis auf zwei Aufrufe — nichts wird gekuerzt', () => {
    const viele = Array.from({ length: MAX_PLAYLIST_STAPEL + 2 }, (_, i) => eintrag(i + 1, `Abend ${i + 1}`))
    const auswahl = viele.map((e) => e.position)
    expect(() => planePlaylistAnlage({ entries: viele, auswahl, vorhandeneNamen: [] })).toThrow(/hoechstens 30 — in zwei Aufrufen/)
    expect(() => planePlaylistAnlage({ entries: viele, auswahl: [], vorhandeneNamen: [] })).toThrow(/leer/)
    // Doppelte in der Auswahl zaehlen einmal.
    const plan = planePlaylistAnlage({ entries: viele, auswahl: [...auswahl.slice(0, 30), 1, 2], vorhandeneNamen: [] })
    expect(plan).toHaveLength(30)
  })
})
