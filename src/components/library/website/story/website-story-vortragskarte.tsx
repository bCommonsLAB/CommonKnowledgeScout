'use client'

/**
 * Ein zitiertes Dokument als Galerie-Karte mit seiner Zitatnummer (Owner
 * 09.11.2026, Figma S2-A/S2-B): dieselbe `DocumentCard` wie Galerie und
 * Banner, in der niedrigen Teaser-Form (Owner 10.11.2026: ohne Cover-Thumbnail —
 * Cover und Personenbild standen fast gleich gross nebeneinander — und ohne
 * die Zeilen Autor, Seiten, Datum; Track oben neben dem Jahr), darueber die
 * Zitatmarke der Belegkarte (`groesse="karte"`) oben links.
 *
 * Der Klick oeffnet die Detailansicht UEBER der Startseite (10.11.2026) —
 * die Seite bleibt im Hintergrund, kein Wechsel in die Galerie.
 *
 * Solange die Karte laedt (`eintrag.doc === null`), steht an derselben Stelle
 * ein Platzhalter mit Nummer und Titel aus der Referenz.
 *
 * `id="beleg-k"`: eine Marke im Antworttext scrollt zu dieser Karte
 * (`AntwortText` sucht `#beleg-k`), wie zur Belegkarte des Story-Modus.
 */

import type { DocCardMeta } from '@ks/contracts'
import { DocumentCard } from '@ks/module-explorer/react'
import { Zitatmarke } from '@ks/ui'
import type { KartenEintrag } from '@/lib/website/story-karten'

export interface WebsiteStoryVortragskarteProps {
  eintrag: KartenEintrag
  libraryId: string
  /** Oeffnet die Detailansicht des Eintrags ueber der Seite. */
  onOpen: (doc: DocCardMeta) => void
}

const MARKE = 'pointer-events-none absolute -left-2 -top-2 z-20 shadow-md ring-2 ring-white'

export function WebsiteStoryVortragskarte({ eintrag, libraryId, onOpen }: WebsiteStoryVortragskarteProps) {
  const { nummer, doc, titel } = eintrag
  return (
    <div className="relative min-w-0" id={`beleg-${nummer}`} data-story-karte={nummer} data-story-karte-laedt={doc ? undefined : 'true'}>
      {doc ? (
        <DocumentCard doc={doc} libraryId={libraryId} cardDensity="compact" teaser onOpen={onOpen} />
      ) : (
        <div className="min-h-[9rem] animate-pulse rounded-xl border border-black/10 bg-neutral-50 p-6" aria-busy="true">
          <p className="line-clamp-2 text-lg font-semibold text-neutral-400">{titel}</p>
          <div className="mt-4 h-3 w-2/3 rounded bg-neutral-200" />
        </div>
      )}
      {/* Ueber der linken oberen Ecke, damit Sterne-Plakette und Jahr der Karte frei bleiben. */}
      <Zitatmarke nummer={nummer} groesse="karte" className={MARKE} aria-hidden="true" />
    </div>
  )
}
