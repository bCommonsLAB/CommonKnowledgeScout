/**
 * Die Renderer-Tabelle der Voll-App ist vollstaendig — zur Laufzeit, nicht nur
 * im Typ (Welle M4g).
 *
 * `Record<DetailViewType, DetailRenderer>` faengt einen neuen Typ beim
 * Kompilieren. Dieser Test faengt den Rest: ein `as`-Cast, ein versehentlich
 * geloeschter Eintrag, ein Eintrag, der auf `undefined` zeigt. Dann faellt die
 * Detailansicht im Overlay auf die Buch-Ansicht — laut, aber falsch.
 */

import { describe, it, expect } from 'vitest'
import { DETAIL_VIEW_TYPES } from '@ks/contracts'
import { DETAIL_RENDERERS } from '@/components/library/gallery-detail-renderers'

describe('DETAIL_RENDERERS', () => {
  it('kennt genau die Werteliste aus @ks/contracts', () => {
    expect(Object.keys(DETAIL_RENDERERS).sort()).toEqual([...DETAIL_VIEW_TYPES].sort())
  })

  it('jeder Eintrag ist eine Komponente', () => {
    for (const typ of DETAIL_VIEW_TYPES) {
      expect(typeof DETAIL_RENDERERS[typ], `Renderer fuer "${typ}"`).toBe('function')
    }
  })

  it('testimonial und blog zeigen bewusst die Buch-Ansicht', () => {
    // Festgehalten, nicht bewertet: `testimonial-detail.tsx` existiert, war
    // aber nie angeschlossen. Wer das aendert, aendert Verhalten.
    expect(DETAIL_RENDERERS.testimonial).toBe(DETAIL_RENDERERS.book)
    expect(DETAIL_RENDERERS.blog).toBe(DETAIL_RENDERERS.book)
  })
})
