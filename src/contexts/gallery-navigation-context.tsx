'use client'

/**
 * @fileoverview Wie die Galerie ein Dokument adressiert — ohne Routen zu kennen.
 *
 * @description
 * Sechs Stellen in der Galerie holten `useRouter`, `usePathname` und
 * `useSearchParams` ausschliesslich, um sie an `openDocumentBySlug`
 * weiterzureichen. Sie navigierten nie selbst — sie waren Durchreicher
 * (Galerie-Audit, Neubewertung der Adressierung).
 *
 * Sie sagen jetzt nur noch, WAS passieren soll. WIE es passiert, entscheidet,
 * wer die Galerie montiert:
 *
 * - **Voll-App**: `NextGalleryNavigation` schreibt es in die Adresszeile.
 * - **Embed**: Der Gast fasst die Adresse des Gastgebers nicht an
 *   (Owner-Entscheidung 2026-08-29). Dort fuehrt das Modul den Zustand selbst.
 *
 * Bewusst drei Methoden, abgelesen statt ausgedacht — genau das, was die sechs
 * Aufrufstellen und der Teilen-Knopf brauchen.
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
        'braucht eine Adressierung. In der App liefert sie NextGalleryNavigation ' +
        '(src/app/library/gallery/client.tsx).'
    )
  }
  return navigation
}
