'use client'

/**
 * @fileoverview Wie die Galerie adressiert — ohne Routen zu kennen.
 *
 * @description
 * Teil A (Galerie-Audit): Sechs Stellen holten `useRouter`, `usePathname`
 * und `useSearchParams` nur, um sie an `openDocumentBySlug` weiterzureichen.
 * Sie sagen seither nur noch WAS passieren soll.
 *
 * Teil B (Welle M4f): Die letzten drei Dateien, die selbst navigierten
 * (`gallery-root`, `use-gallery-mode`, `switch-to-story-mode-button`) und die
 * Filter-Kontextleiste lesen und schreiben die Adresse jetzt ebenfalls nur
 * noch hier. Die Galerie hat damit keinen Import aus `next/navigation` mehr.
 *
 * Die Schreib-Formen sind abgelesen, nicht ausgedacht — es gibt heute genau
 * drei, und sie unterscheiden sich im Verlaufseintrag:
 *
 * - `replaceParams` — ohne Eintrag: Dokument oeffnen/schliessen, Story-Wechsel
 * - `pushParams` — mit Eintrag: die Knoepfe der Filter-Kontextleiste
 * - `applyModeParams` — Ansichtswechsel; ob mit oder ohne Eintrag, entscheidet
 *   die App nach Route (heute: ohne auf `/explore`, mit auf `/library/gallery`)
 *
 * WIE das in eine Adresse wird, entscheidet, wer die Galerie montiert:
 *
 * - **Voll-App**: `NextGalleryNavigation` schreibt in die Adresszeile.
 * - **Embed**: Der Gast fasst die Adresse des Gastgebers nicht an
 *   (Owner-Entscheidung 2026-08-29). Dort fuehrt das Modul den Zustand selbst.
 *
 * @module contexts
 */

import { createContext, useContext, type ReactNode } from 'react'

export interface GalleryNavigation {
  /** Ein Dokument oeffnen (Slug aus `getEffectiveDocumentNavigationSlug`). */
  openDocument(slug: string): void
  /** Die Detailansicht schliessen. */
  closeDocument(): void
  /**
   * Teilbare Adresse eines Dokuments.
   *
   * Gibt einen leeren String zurueck, wenn keine teilbare Adresse gebildet
   * werden kann — der Teilen-Knopf blendet sich dann aus, statt einen Link
   * anzubieten, der ins Leere zeigt. Genau das passiert heute im Embed:
   * `window.location.origin` waere dort die Adresse der fremden Seite.
   */
  documentShareUrl(slug: string): string
  /**
   * Die aktuellen Adress-Parameter der Galerie — `doc`, `mode`, `view`,
   * `sort`, `starred`, `favorites`, `commented`. Nur lesen; schreiben geht
   * ueber die drei Methoden darunter.
   */
  params: URLSearchParams
  /** Parameter ersetzen, ohne Verlaufseintrag. */
  replaceParams(next: URLSearchParams): void
  /** Parameter setzen, mit Verlaufseintrag. */
  pushParams(next: URLSearchParams): void
  /**
   * Ansicht wechseln (`site` | `gallery` | `story`). Die Parameter kommen aus
   * `nextParamsForMode`; ob ein Verlaufseintrag entsteht, ist Sache der App.
   */
  applyModeParams(next: URLSearchParams): void
  /**
   * Zur Perspektiven-Wahl springen — wenn der Story-Modus ohne gesetzte
   * Perspektive startet. In der App ist das eine eigene Seite; sie kennt ihre
   * Routen und entscheidet, ob es dort etwas zu springen gibt.
   */
  openPerspective(libraryId: string | null): void
}

// Ohne Default: Ein fehlender Anbieter ist ein Verdrahtungsfehler und soll
// auffallen (docs/contracts/no-silent-fallbacks.md).
const GalleryNavigationContext = createContext<GalleryNavigation | null>(null)

export function GalleryNavigationProvider({
  navigation,
  children,
}: {
  navigation: GalleryNavigation
  children: ReactNode
}) {
  return (
    <GalleryNavigationContext.Provider value={navigation}>
      {children}
    </GalleryNavigationContext.Provider>
  )
}

export function useGalleryNavigation(): GalleryNavigation {
  const navigation = useContext(GalleryNavigationContext)
  if (navigation === null) {
    throw new Error(
      'useGalleryNavigation ausserhalb von GalleryNavigationProvider — die Galerie ' +
        'braucht eine Adressierung. In der App liefert sie GalleryAppProviders ' +
        '(src/components/providers/gallery-app-providers.tsx).'
    )
  }
  return navigation
}
