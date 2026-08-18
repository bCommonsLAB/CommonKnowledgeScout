/**
 * @fileoverview Unit-Tests: Handkorrektur-Vorrang (Welle 0d)
 *
 * Befund aus dem Archiv-Pilot: Eine im Spiegel korrigierte Transkript-Datei
 * verlor gegen die Datenbank-Fassung, weil der Gewinner nach Score
 * (Seiten, dann Laenge) gewaehlt wird — eine Korrektur macht den Text aber
 * meist nicht laenger. Der naechste Reparatur-Lauf haette die Handarbeit
 * zurueckgeschrieben; Contract §4.5 verspricht das Gegenteil.
 */

import { describe, it, expect } from 'vitest'
import { buildTranscriptReconcilePlan } from '@/lib/shadow-twin/reconcile-plan'

const T0 = new Date('2026-08-18T09:00:00Z')
const T1 = new Date('2026-08-18T11:00:00Z')

const plan = (candidates: Parameters<typeof buildTranscriptReconcilePlan>[0]['transcriptCandidates']) =>
  buildTranscriptReconcilePlan({ canonicalName: 'doc.md', transcriptCandidates: candidates })

describe('Handkorrektur-Vorrang', () => {
  it('juengere Storage-Fassung gewinnt, auch wenn sie kuerzer ist', () => {
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: 'Text mit Superbase und mehr Worten', origin: 'storage', modifiedAt: T1 },
      { name: 'doc.md', markdown: 'Text mit Superbase und mehr Worten!!!', origin: 'mongo', modifiedAt: T0 },
    ])
    // Korrektur-Fassung ist kuerzer -> ohne die Regel haette Mongo gewonnen.
    expect(p.status).toBe('ok')
    expect(p.winnerOrigin).toBe('storage')
    expect(p.mongoNeedsUpdate).toBe(true)
    expect(p.canonicalNeedsWrite).toBe(false)
  })

  it('aeltere Storage-Fassung bekommt keinen Vorrang (Score entscheidet)', () => {
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: 'kurz', origin: 'storage', modifiedAt: T0 },
      { name: 'doc.md', markdown: 'deutlich laengerer Inhalt aus der Datenbank', origin: 'mongo', modifiedAt: T1 },
    ])
    expect(p.winnerOrigin).toBe('mongo')
  })

  it('Seitenverlust schlaegt den Vorrang (Schutz des Migrationsfalls)', () => {
    const vollstaendig = 'page_001\nEins und viel Text\npage_002\nZwei und noch mehr Text'
    const abgeschnitten = 'page_001\nEins und viel Text'
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: abgeschnitten, origin: 'storage', modifiedAt: T1 },
      { name: 'doc.md', markdown: vollstaendig, origin: 'mongo', modifiedAt: T0 },
    ])
    expect(p.winnerOrigin).toBe('mongo')
  })

  it('inhaltsgleiche juengere Datei loest nichts aus', () => {
    const gleich = 'identischer Inhalt'
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: gleich, origin: 'storage', modifiedAt: T1 },
      { name: 'doc.md', markdown: gleich, origin: 'mongo', modifiedAt: T0 },
    ])
    expect(p.mongoNeedsUpdate).toBe(false)
    expect(p.canonicalNeedsWrite).toBe(false)
  })

  it('ohne Zeitstempel bleibt es bei der Score-Logik', () => {
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: 'kurze Korrektur', origin: 'storage' },
      { name: 'doc.md', markdown: 'laengerer Inhalt aus der Datenbank', origin: 'mongo' },
    ])
    expect(p.winnerOrigin).toBe('mongo')
  })

  it('Handkorrektur loescht keine anderen Varianten (konservativ)', () => {
    const p = plan([
      { fileId: 'f-1', name: 'doc.md', markdown: 'korrigierte Fassung', origin: 'storage', modifiedAt: T1 },
      { fileId: 'f-2', name: 'doc.de.md', markdown: 'alte Variante mit mehr Text drin', origin: 'storage', modifiedAt: T0 },
      { name: 'doc.md', markdown: 'Datenbank-Fassung mit mehr Text', origin: 'mongo', modifiedAt: T0 },
    ])
    expect(p.winnerOrigin).toBe('storage')
    expect(p.deletions).toEqual([])
  })
})
