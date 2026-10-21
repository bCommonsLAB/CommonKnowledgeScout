/**
 * Welle K3 — Befunde statt stummem completed. Pruefkriterium aus dem Plan:
 * Der Index-Job vom 11.10. (0 von 58) haette „Folien: 58 von 58 ohne Adresse"
 * gezeigt; ein Job nach #376 zeigt eine leere Liste.
 */
import { describe, expect, it } from 'vitest'
import { befundeFuerJob } from '@/lib/mcp/job-befunde'
import { ereignisseAusTrace } from '@/lib/mcp/job-ereignisse'
import type { ExternalJobStep } from '@/types/external-job'

const namen = (n: number) => Array.from({ length: n }, (_, i) => `preview_${String(i + 1).padStart(3, '0')}.jpg`)

function ereignisse(events: Array<{ name: string; attributes: Record<string, unknown> }>) {
  return ereignisseAusTrace({ trace: { events } })
}

describe('befundeFuerJob', () => {
  it('nennt den Index-Job vom 11.10. (0 von 58, kein Cover, keine Anhaenge) in drei Zeilen', () => {
    const steps: ExternalJobStep[] = [
      { name: 'ingest_rag', status: 'completed', details: { slideImages: { resolved: 0, unresolved: namen(58) } } },
    ]
    const befunde = befundeFuerJob({
      status: 'completed', steps,
      ereignisse: ereignisse([
        { name: 'slide_images_resolved', attributes: { resolved: 0, unresolved: 58 } },
        { name: 'cover_source', attributes: { source: 'none', grund: 'keine PDF-Quelle mit Seitenbildern' } },
        { name: 'attachments_source', attributes: { anzahl: 0, namen: [] } },
      ]),
    })
    expect(befunde).toHaveLength(3)
    expect(befunde[0]).toMatch(/^Folien: 58 von 58 ohne Adresse \(preview_001\.jpg, .*preview_010\.jpg, … \+48\)$/)
    expect(befunde[1]).toBe('Cover: keine Quelle (keine PDF-Quelle mit Seitenbildern)')
    expect(befunde[2]).toMatch(/^Anhaenge: keine PDF-Quelle/)
  })

  it('liefert eine leere Liste fuer den Job nach #376 (58 von 58, Cover aus Folien, ein Anhang)', () => {
    const befunde = befundeFuerJob({
      status: 'completed',
      steps: [{ name: 'ingest_rag', status: 'completed', details: { slideImages: { resolved: 58, unresolved: [] } } }],
      ereignisse: ereignisse([
        { name: 'slide_images_resolved', attributes: { resolved: 58, unresolved: 0 } },
        { name: 'cover_source', attributes: { source: 'slides', page: 2 } },
        { name: 'attachments_source', attributes: { anzahl: 1, namen: ['Corbo.pdf'] } },
      ]),
    })
    expect(befunde).toEqual([])
  })

  it('rechnet Folien aus den Ereignissen, wenn der Schritt keine Bilanz traegt', () => {
    const befunde = befundeFuerJob({
      status: 'completed', steps: [],
      ereignisse: ereignisse([
        { name: 'slide_images_resolved', attributes: { resolved: 20, unresolved: 2 } },
        { name: 'slide_images_unresolved', attributes: { unresolved: ['preview_021.jpg', 'preview_022.jpg'] } },
      ]),
    })
    expect(befunde).toEqual(['Folien: 2 von 22 ohne Adresse (preview_021.jpg, preview_022.jpg)'])
  })

  it('traegt den Uebersprungen-Hinweis und die Seitenbild-/Frontmatter-Befunde mit', () => {
    const steps: ExternalJobStep[] = [
      { name: 'transform_template', status: 'completed', details: { skipped: true, reason: 'shadow_twin_exists' } },
      { name: 'ingest_rag', status: 'completed' },
    ]
    const befunde = befundeFuerJob({
      status: 'completed', steps,
      ereignisse: ereignisseAusTrace({
        logs: [{ phase: 'frontmatter_json_list_invalid', message: 'slides (Unexpected token)' }],
        trace: { events: [
          { name: 'extract_only_page_images_skipped', attributes: { grund: 'kein_twin_ordner' } },
          { name: 'extract_only_page_images_registered', attributes: { twinItems: 9, registriert: 0 } },
          { name: 'extract_only_page_images_error', attributes: { message: 'ENOENT' } },
        ] },
      }),
    })
    expect(befunde[0]).toMatch(/^Die TRANSFORMATION wurde uebersprungen \(shadow_twin_exists\)/)
    expect(befunde.slice(1)).toEqual([
      'Seitenbilder: nicht registriert (kein_twin_ordner)',
      'Seitenbilder: keine aus dem Twin-Ordner registriert (9 Dateien im Twin-Ordner gesehen)',
      'Seitenbilder: Registrierung fehlgeschlagen (ENOENT)',
      'Frontmatter: Listenfeld als JSON-Text nicht lesbar — slides (Unexpected token)',
    ])
  })

  it('nennt eine unbekannte Cover-Herkunft statt sie still zu uebergehen', () => {
    const befunde = befundeFuerJob({ status: 'completed', steps: [], ereignisse: ereignisse([{ name: 'cover_source', attributes: { source: 'generated' } }]) })
    expect(befunde).toEqual(['Cover: unbekannte Herkunft "generated"'])
  })

  it('kennt das Cover aus einem eigenen Fragment (Webseite als Quelle, 2.51.0) als gueltige Herkunft', () => {
    const befunde = befundeFuerJob({ status: 'completed', steps: [], ereignisse: ereignisse([{ name: 'cover_source', attributes: { source: 'own_fragment', sourceName: 'x - Cover.jpg' } }]) })
    expect(befunde).toEqual([])
  })
})

describe('befundeFuerJob — Playlist-Lesejob (2.61.1)', () => {
  it('nennt gescheiterte Videos aus den Schrittdetails web_source; ohne Fehlschlag keine Zeile', () => {
    const steps: ExternalJobStep[] = [{ name: 'web_source', status: 'completed', details: { eintraege: 32, lesbar: 30, ohneDatum: 5, fehlgeschlagen: 5, ersterFehler: 'Secretary media/resolve: [MEDIA_NOT_RESOLVABLE] Sign in to confirm you’re not a bot' } }]
    expect(befundeFuerJob({ status: 'completed', steps, ereignisse: [] })).toEqual(['Playlist: 5 von 30 Videos nicht lesbar (erster Fehler: Secretary media/resolve: [MEDIA_NOT_RESOLVABLE] Sign in to confirm you’re not a bot)'])
    const ok: ExternalJobStep[] = [{ name: 'web_source', status: 'completed', details: { eintraege: 32, lesbar: 32, ohneDatum: 0, fehlgeschlagen: 0, ersterFehler: null } }]
    expect(befundeFuerJob({ status: 'completed', steps: ok, ereignisse: [] })).toEqual([])
  })
})
