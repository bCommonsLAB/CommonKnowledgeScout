'use client'

/**
 * @fileoverview Eine Galerie-Karte ausserhalb der Galerie: der Teaser im Job-Report-Tab.
 *
 * @description
 * Der Job-Report-Tab zeigt unter „Listung in der Galerieansicht", wie ein
 * Dokument spaeter als Karte aussieht. Dafuer rendert er `DocumentCard` — aber
 * unter `/library`, nicht unter dem Galerie-Montagepunkt
 * (`src/app/library/gallery/client.tsx`).
 *
 * Seit Adressierung Teil A (#234) holt die Karte keinen Router mehr, sondern
 * sagt nur noch `openDocument(slug)` an einen Anbieter. Ohne Anbieter wirft
 * `useGalleryNavigation` absichtlich (no-silent-fallbacks) — und genau das
 * passierte hier: Der Teaser lag ausserhalb jedes Anbieters. Die Welle hat die
 * sechs Aufrufstellen IN der Galerie umgestellt und diese eine AUSSERHALB
 * uebersehen; der Unit-Test der Karte mockt den Kontext und konnte es nicht
 * sehen.
 *
 * Diese Huelle stellt den Zustand von vor #234 wieder her: `GalleryAppProviders`
 * (Adressierung + Gastgeber) fuehrt einen Klick auf der `/library`-Route per `openDocumentBySlug` zu
 * `/library/gallery?doc=…` — wie die Karte es frueher selbst getan hat
 * (`tests/unit/utils/document-navigation-routen.test.ts`, Fall „push auf
 * Nicht-Galerie-Route").
 *
 * Wer kuenftig eine Galerie-Karte ausserhalb der Galerie zeigt, nimmt diese
 * Komponente. `karte-ausserhalb-galerie.test.ts` haelt das fest.
 *
 * @module components/library/file-preview
 */

import { GalleryAppProviders } from '@/components/providers/gallery-app-providers'
import { DocumentCard } from '@ks/module-explorer/react'
import type { DocCardMeta } from '@ks/contracts'

export function GalleryTeaserCard({ doc }: { doc: DocCardMeta }) {
  return (
    <GalleryAppProviders>
      <DocumentCard doc={doc} />
    </GalleryAppProviders>
  )
}
