import { describe, expect, it } from 'vitest'
import { parsePlaylistAntwort } from '@/lib/web-source/playlist-resolve'

const URL = 'https://www.youtube.com/playlist?list=PL1'

describe('parsePlaylistAntwort (Welle K1)', () => {
  it('liest Kopf und Eintraege; ein privater Eintrag bleibt mit Grund in der Liste', () => {
    const p = parsePlaylistAntwort({
      title: 'Dialogreihe', uploader: 'Kanal', description: 'Alle Abende', anzahl: 3,
      entries: [
        { position: 1, id: 'aaa', url: 'https://www.youtube.com/watch?v=aaa', title: 'Abend 1', duration: 3600 },
        { position: 2, id: 'bbb', url: 'https://www.youtube.com/watch?v=bbb', title: 'Abend 2', grund: 'privat' },
        { position: 3, id: 'ccc', url: 'https://www.youtube.com/watch?v=ccc', title: 'Abend 3', verfuegbar: false },
      ],
    }, URL)
    expect(p.title).toBe('Dialogreihe')
    expect(p.anzahl).toBe(3)
    expect(p.entries).toHaveLength(3)
    expect(p.entries[0]).toEqual({ position: 1, id: 'aaa', url: 'https://www.youtube.com/watch?v=aaa', title: 'Abend 1', duration: 3600, grund: null })
    expect(p.entries[1].grund).toBe('privat')
    expect(p.entries[2].grund).toMatch(/nicht verfuegbar/)
  })

  it('Position fehlt: Reihenfolge der Liste, 1-basiert; Dauer unbekannt ist null', () => {
    const p = parsePlaylistAntwort({ title: 'x', entries: [{ id: 'a', url: 'https://v/a', title: 'A' }, { id: 'b', url: 'https://v/b', title: 'B' }] }, URL)
    expect(p.entries.map((e) => e.position)).toEqual([1, 2])
    expect(p.entries[0].duration).toBeNull()
    expect(p.anzahl).toBe(2)
  })

  it('leere Liste, fehlende entries und Eintrag ohne id/url scheitern laut', () => {
    expect(() => parsePlaylistAntwort({ title: 'x', entries: [] }, URL)).toThrow(/leer/)
    expect(() => parsePlaylistAntwort({ title: 'x' }, URL)).toThrow(/ohne entries/)
    expect(() => parsePlaylistAntwort(null, URL)).toThrow(/ohne data/)
    expect(() => parsePlaylistAntwort({ entries: [{ title: 'ohne Adresse' }] }, URL)).toThrow(/Eintrag 1 ohne id\/url/)
  })
})

describe('parsePlaylistAntwort gegen die Antwortform des Secretary (Welle S, CommonSecretaryServices #44)', () => {
  it('liest die echte Form: verfuegbar/grund je Eintrag, null-Felder, anzahl_verfuegbar und channel im Kopf', () => {
    const p = parsePlaylistAntwort({
      id: 'PL1', title: 'Dialogreihe', uploader: 'Kanal', channel: 'Kanal', description: null, webpage_url: URL, anzahl: 2, anzahl_verfuegbar: 1,
      entries: [
        { position: 1, id: 'aaa', url: 'https://www.youtube.com/watch?v=aaa', title: 'Abend 1', duration: null, verfuegbar: true, grund: null },
        { position: 2, id: 'bbb', url: 'https://www.youtube.com/watch?v=bbb', title: '[Private video]', duration: null, verfuegbar: false, grund: 'privat' },
      ],
    }, URL)
    expect(p.description).toBe('')
    expect(p.anzahl).toBe(2)
    expect(p.entries[0]).toMatchObject({ position: 1, title: 'Abend 1', duration: null, grund: null })
    expect(p.entries[1]).toMatchObject({ position: 2, title: '[Private video]', grund: 'privat' })
  })
})
