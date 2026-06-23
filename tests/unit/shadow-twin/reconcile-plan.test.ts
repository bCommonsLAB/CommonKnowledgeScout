/**
 * @fileoverview Unit-Tests fuer buildTranscriptReconcilePlan (reine Reconcile-Logik).
 */

import { describe, it, expect } from 'vitest'
import {
  buildTranscriptReconcilePlan,
  type ReconcileCandidate,
} from '@/lib/shadow-twin/reconcile-plan'

function pages(n: number, filler = ''): string {
  const blocks = Array.from({ length: n }, (_, i) => `# page_${String(i + 1).padStart(3, '0')}.jpeg\nSeite: ${i + 1}`)
  return blocks.join('\n\n') + (filler ? `\n\n${filler}` : '')
}

const SINGLE = '# page_020.jpeg\nSeite: 20\nDonation'

describe('buildTranscriptReconcilePlan', () => {
  it('Ökoniomie: volle .en.md gewinnt, kanonische .md wird ueberschrieben, Mongo aktualisiert, .en.md geloescht', () => {
    const candidates: ReconcileCandidate[] = [
      { fileId: 'f-md', name: 'doc.md', markdown: SINGLE, origin: 'storage' }, // stale suffixlos
      { fileId: 'f-en', name: 'doc.en.md', markdown: pages(20), origin: 'storage' }, // voll
      { name: 'doc.md', markdown: SINGLE, origin: 'mongo' }, // kaputter Mongo-Record
    ]
    const plan = buildTranscriptReconcilePlan({ canonicalName: 'doc.md', transcriptCandidates: candidates })

    expect(plan.status).toBe('ok')
    expect(plan.winnerName).toBe('doc.en.md')
    expect(plan.winnerOrigin).toBe('storage')
    expect(plan.canonicalNeedsWrite).toBe(true) // doc.md (storage) ist die Einzelseite -> ueberschreiben
    expect(plan.mongoNeedsUpdate).toBe(true)
    // Loeschbar: die volle .en.md (Inhalt wandert nach doc.md); die stale doc.md wird NICHT geloescht (ueberschrieben).
    expect(plan.deletions.map((d) => d.fileId)).toEqual(['f-en'])
  })

  it('bereits kanonisch & korrekt: nichts schreiben, nichts loeschen', () => {
    const full = pages(20)
    const candidates: ReconcileCandidate[] = [
      { fileId: 'f-md', name: 'doc.md', markdown: full, origin: 'storage' },
      { name: 'doc.md', markdown: full, origin: 'mongo' },
    ]
    const plan = buildTranscriptReconcilePlan({ canonicalName: 'doc.md', transcriptCandidates: candidates })

    expect(plan.status).toBe('ok')
    expect(plan.canonicalNeedsWrite).toBe(false)
    expect(plan.mongoNeedsUpdate).toBe(false)
    expect(plan.deletions).toEqual([])
  })

  it('Konflikt: zwei gleich volle, anderer Inhalt -> nichts an Transkripten, nur tote page_NNN.md', () => {
    const candidates: ReconcileCandidate[] = [
      { fileId: 'f-a', name: 'doc.de.md', markdown: pages(10) + '\nA', origin: 'storage' },
      { fileId: 'f-b', name: 'doc.en.md', markdown: pages(10) + '\nB', origin: 'storage' },
    ]
    const plan = buildTranscriptReconcilePlan({
      canonicalName: 'doc.md',
      transcriptCandidates: candidates,
      deadPageMd: [{ fileId: 'p1', name: 'page_001.md' }],
    })

    expect(plan.status).toBe('conflict')
    expect(plan.canonicalNeedsWrite).toBe(false)
    expect(plan.deletions.map((d) => d.fileId)).toEqual(['p1']) // nur dead-page-md
  })

  it('needs-reextract: alle Varianten 1 Seite, aber 20 erwartet -> melden, nichts loeschen', () => {
    const candidates: ReconcileCandidate[] = [
      { fileId: 'f-md', name: 'doc.md', markdown: SINGLE, origin: 'storage' },
      { name: 'doc.md', markdown: SINGLE, origin: 'mongo' },
    ]
    const plan = buildTranscriptReconcilePlan({
      canonicalName: 'doc.md',
      transcriptCandidates: candidates,
      expectedPages: 20,
    })

    expect(plan.status).toBe('needs-reextract')
    expect(plan.deletions).toEqual([])
  })

  it('empty: keine Transkripte -> status empty, nur dead-page-md loeschbar', () => {
    const plan = buildTranscriptReconcilePlan({
      canonicalName: 'doc.md',
      transcriptCandidates: [],
      deadPageMd: [{ fileId: 'p1', name: 'page_001.md' }],
    })
    expect(plan.status).toBe('empty')
    expect(plan.winnerMarkdown).toBeNull()
    expect(plan.deletions.map((d) => d.fileId)).toEqual(['p1'])
  })

  it('redundantes Duplikat: identische .en.md wird geloescht, kanonische .md bleibt', () => {
    const full = pages(15)
    const candidates: ReconcileCandidate[] = [
      { fileId: 'f-md', name: 'doc.md', markdown: full, origin: 'storage' },
      { fileId: 'f-en', name: 'doc.en.md', markdown: full, origin: 'storage' },
    ]
    const plan = buildTranscriptReconcilePlan({ canonicalName: 'doc.md', transcriptCandidates: candidates })
    expect(plan.status).toBe('ok')
    expect(plan.winnerName).toBe('doc.md') // kanonischer Name gewinnt bei Gleichstand
    expect(plan.canonicalNeedsWrite).toBe(false)
    expect(plan.deletions.map((d) => d.fileId)).toEqual(['f-en'])
  })
})
