'use client'

/**
 * @fileoverview Was die Galerie ihrem Gastgeber sagen kann — und mehr nicht.
 *
 * @description
 * Vier Stellen in der Galerie schrieben direkt in `jobMonitorPanelOpenAtom`,
 * um nach einem angestossenen Hintergrund-Job die Werkbank-Anzeige
 * aufzuklappen. Der Job-Monitor ist aber Werkbank, nicht Galerie — die
 * Galerie hat kein Geschaeft damit, fremde Bedienflaechen zu oeffnen
 * (Galerie-Audit, Gruppe B).
 *
 * Sie sagt jetzt nur noch, DASS etwas laeuft. Ob und wie der Gastgeber das
 * zeigt, entscheidet er:
 *
 * - **Voll-App**: `AppGalleryHost` klappt den Job-Monitor auf, wie bisher.
 * - **Embed**: Eine fremde Seite hat keinen Job-Monitor. Dort ist es ein
 *   No-op — und weil die Galerie nichts zurueckbekommt, faellt das nirgends
 *   auf.
 *
 * Bewusst eine Meldung ohne Rueckgabewert: Die Galerie darf nicht davon
 * abhaengen, dass der Gastgeber reagiert.
 *
 * @module contexts
 */

import { createContext, useContext, type ReactNode } from 'react'

export interface GalleryHost {
  /**
   * Ein Hintergrund-Job wurde angestossen. Der Gastgeber darf Fortschritt
   * zeigen — muss aber nicht.
   */
  jobGestartet(): void
}

/** Gastgeber, der nichts anzuzeigen hat — der Normalfall im Embed. */
export const STILLER_GASTGEBER: GalleryHost = {
  jobGestartet: () => {},
}

// Ohne Default: Ein fehlender Anbieter ist ein Verdrahtungsfehler und soll
// auffallen (docs/contracts/no-silent-fallbacks.md). Wer bewusst nichts
// anzeigen will, reicht STILLER_GASTGEBER herein — das ist eine Aussage,
// kein Versehen.
const GalleryHostContext = createContext<GalleryHost | null>(null)

export function GalleryHostProvider({
  host,
  children,
}: {
  host: GalleryHost
  children: ReactNode
}) {
  return <GalleryHostContext.Provider value={host}>{children}</GalleryHostContext.Provider>
}

export function useGalleryHost(): GalleryHost {
  const host = useContext(GalleryHostContext)
  if (host === null) {
    throw new Error(
      'useGalleryHost ausserhalb von GalleryHostProvider — die Galerie braucht einen ' +
        'Gastgeber. In der App liefert ihn AppGalleryHost (src/app/library/gallery/client.tsx), ' +
        'im Embed STILLER_GASTGEBER.'
    )
  }
  return host
}
