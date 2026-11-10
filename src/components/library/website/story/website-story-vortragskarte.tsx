'use client'

/**
 * Ein zitiertes Dokument als Galerie-Bildkarte mit seiner Zitatnummer (Owner
 * 09.11.2026, Figma S2-A/S2-B): dieselbe `DocumentCard` wie Galerie und
 * Banner (SFSCON-Talks sind `session` → `SessionCard`, 16:9 mit Cover), in
 * der kompakten Form, darüber die Zitatmarke der Belegkarte (`groesse="karte"`)
 * oben links. Der Klick oeffnet den Eintrag wie eine Banner-Karte (Site-Modus
 * `onShowGallery({ doc })`, Root-Modus Galerie-Adresse mit `?doc=`).
 *
 * `id="beleg-k"`: eine Marke im Antworttext scrollt zu dieser Karte
 * (`AntwortText` sucht `#beleg-k`), wie zur Belegkarte des Story-Modus.
 */

import { DocumentCard } from '@ks/module-explorer/react'
import { Zitatmarke } from '@ks/ui'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import type { KartenEintrag } from '@/lib/website/story-karten'

export interface WebsiteStoryVortragskarteProps {
  eintrag: KartenEintrag
  libraryId: string
  /** Oeffnet den Eintrag in der Galerie (Slug des Dokuments). */
  onOpen: (slug: string) => void
}

export function WebsiteStoryVortragskarte({ eintrag, libraryId, onOpen }: WebsiteStoryVortragskarteProps) {
  const { nummer, doc } = eintrag
  const oeffnen = () => {
    const slug = getEffectiveDocumentNavigationSlug(doc)
    if (!slug) {
      console.error(`[Story-Sektion] Dokument ${doc.fileId ?? doc.id} hat keinen Slug — Karte kann nicht oeffnen`)
      return
    }
    onOpen(slug)
  }
  return (
    <div className="relative min-w-0" id={`beleg-${nummer}`} data-story-karte={nummer}>
      <DocumentCard doc={doc} libraryId={libraryId} cardDensity="compact" onOpen={oeffnen} />
      {/* Ueber der linken oberen Ecke, damit Sterne-Plakette und Jahr der Karte frei bleiben. */}
      <Zitatmarke nummer={nummer} groesse="karte" className="pointer-events-none absolute -left-2 -top-2 z-20 shadow-md ring-2 ring-white" aria-hidden="true" />
    </div>
  )
}
