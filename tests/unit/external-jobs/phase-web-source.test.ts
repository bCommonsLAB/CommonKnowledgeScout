/**
 * Cowork-Befund 21.10.2026: Der Lesejob meldete completed mit ohneDatum: 0,
 * obwohl alle 32 Einzelabrufe an YouTube gescheitert waren. Die Bilanz muss
 * Fehlschlaege zaehlen und den ersten Grund nennen.
 */
import { describe, expect, it } from 'vitest'
import { playlistLesenBilanz, type PlaylistLesenEintrag } from '@/lib/external-jobs/phase-web-source'

function zeile(position: number, teil: Partial<PlaylistLesenEintrag> & { fehler?: boolean }): PlaylistLesenEintrag & { fehler?: boolean } {
  return { position, id: `id${position}`, titel: `Abend ${position}`, url: `https://www.youtube.com/watch?v=id${position}`, datum: '', ordnerVorschlag: '', grund: null, ...teil }
}

describe('playlistLesenBilanz', () => {
  it('zaehlt gescheiterte Abrufe als ohneDatum UND fehlgeschlagen, nennt den ersten Fehler', () => {
    const b = playlistLesenBilanz([
      zeile(1, { datum: '2015-11-09', ordnerVorschlag: '2015-11-09 Abend 1' }),
      zeile(2, { grund: 'Secretary media/resolve: Sign in to confirm you’re not a bot', fehler: true }),
      zeile(3, { grund: 'Secretary media/resolve: Sign in to confirm you’re not a bot', fehler: true }),
      zeile(4, { grund: 'yt-dlp nennt kein Upload-Datum — Vorschlag nach Position' }),
      zeile(5, { grund: 'nicht abrufbar: privat' }),
    ])
    expect(b).toEqual({ eintraege: 5, lesbar: 4, ohneDatum: 3, fehlgeschlagen: 2, ersterFehler: 'Secretary media/resolve: Sign in to confirm you’re not a bot' })
  })

  it('alle lesbaren gescheitert: fehlgeschlagen == lesbar (die Phase setzt den Job dann auf failed)', () => {
    const b = playlistLesenBilanz([zeile(1, { grund: 'bot', fehler: true }), zeile(2, { grund: 'bot', fehler: true }), zeile(3, { grund: 'nicht abrufbar: geloescht' })])
    expect(b.lesbar).toBe(2)
    expect(b.fehlgeschlagen).toBe(2)
    expect(b.ohneDatum).toBe(2)
  })

  it('ohne Fehlschlag: fehlgeschlagen 0, ersterFehler null', () => {
    expect(playlistLesenBilanz([zeile(1, { datum: '2015-11-09' })])).toEqual({ eintraege: 1, lesbar: 1, ohneDatum: 0, fehlgeschlagen: 0, ersterFehler: null })
  })
})
