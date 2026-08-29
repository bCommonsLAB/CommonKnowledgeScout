/**
 * Welle ST9 — die ungefilterte Job-Liste verschweigt keine Fehlschlaege mehr.
 *
 * Praxisbilanz 28.08.2026: „Die offene Job-Liste meldete Ruhe, waehrend
 * vierzehn von fuenfzehn Jobs gescheitert waren." Wer auf seinen Stapel
 * wartet, liest Ruhe als Erfolg.
 */
import { describe, expect, it } from 'vitest'
import { FEHLSCHLAG_FENSTER_MS, zaehleKuerzlichGescheitert } from '@/lib/mcp/job-liste-ehrlich'

const JETZT = new Date('2026-08-28T16:00:00Z')

describe('zaehleKuerzlichGescheitert', () => {
  it('zaehlt Fehlschlaege der letzten Stunde und nennt ihre jobIds', () => {
    const ergebnis = zaehleKuerzlichGescheitert([
      { jobId: 'frisch-1', updatedAt: new Date('2026-08-28T15:45:00Z') },
      { jobId: 'frisch-2', updatedAt: '2026-08-28T15:59:00Z' },
      { jobId: 'gestern', updatedAt: new Date('2026-08-27T16:00:00Z') },
    ], JETZT)
    expect(ergebnis.anzahl).toBe(2)
    expect(ergebnis.jobIds).toEqual(['frisch-1', 'frisch-2'])
    expect(ergebnis.hinweis).toMatch(/GESCHEITERT/)
    expect(ergebnis.hinweis).toMatch(/job_status/)
  })

  it('meldet Ruhe nur, wenn wirklich Ruhe ist', () => {
    const ergebnis = zaehleKuerzlichGescheitert([
      { jobId: 'alt', updatedAt: new Date(JETZT.getTime() - FEHLSCHLAG_FENSTER_MS - 1000) },
    ], JETZT)
    expect(ergebnis.anzahl).toBe(0)
    expect(ergebnis.hinweis).toBeNull()
  })

  it('zaehlt unlesbare Zeitstempel NICHT mit — kein geratener Alarm', () => {
    const ergebnis = zaehleKuerzlichGescheitert([
      { jobId: 'kaputt', updatedAt: 'kein-datum' },
      { jobId: 'leer', updatedAt: null },
      { jobId: 'fehlt' },
    ], JETZT)
    expect(ergebnis.anzahl).toBe(0)
  })

  it('kappt die jobId-Liste bei 15, zaehlt aber alle', () => {
    const viele = Array.from({ length: 20 }, (_, i) => ({
      jobId: `j${i}`, updatedAt: new Date(JETZT.getTime() - 1000),
    }))
    const ergebnis = zaehleKuerzlichGescheitert(viele, JETZT)
    expect(ergebnis.anzahl).toBe(20)
    expect(ergebnis.jobIds).toHaveLength(15)
  })
})
