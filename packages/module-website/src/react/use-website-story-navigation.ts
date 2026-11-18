'use client'

/**
 * Weg aus der Story-Sektion in die Galerie (Welle N1, herausgelöst 09.11.2026
 * für die Karten-Darstellungen). Seit WE3 über die Navigation-Schnittstelle:
 * Ziel `dokument` bzw. `galerie` — in der App Rückruf im Site-Modus und
 * `router.push` im Root-Modus (`appNavigation`), im Embed die Adresse der
 * Container-Seite. Dazu die `GalleryNavigation`, die `DocumentCard` und
 * `ReferencesSheet` aus `@ks/module-explorer` als Kontext verlangen; alles,
 * was die Sektion nicht braucht, wirft statt still nichts zu tun.
 */

import { useCallback, useMemo } from 'react'
import type { GalleryNavigation } from '@ks/module-explorer/react'
import { wegFehltMelden, type WebsiteNavigation, type WebsiteZiel } from '..'

function nichtVorgesehen(name: string): never {
  throw new Error(`Story-Sektion: ${name} ist hier nicht vorgesehen`)
}

/**
 * `oeffneLokal`: die Detailansicht ueber der Startseite (Owner 10.11.2026 — der
 * Klick auf einen Beleg soll die Seite nicht verlassen). Liefert true, wenn das
 * Dokument zum Slug bekannt war und geoeffnet wurde; sonst geht es wie bisher in
 * die Galerie, und das steht im Protokoll.
 */
export type OeffneLokal = (slug: string, page?: number) => boolean

/** Einen Weg gehen; ohne Weg oder ohne Rueckruf steht es in der Konsole (der Beleg ist kein Link). */
export function wegGehen(navigation: WebsiteNavigation, ziel: WebsiteZiel): void {
  const weg = navigation.weg(ziel)
  if (weg === null) {
    wegFehltMelden(`Story-Sektion: Ziel ${ziel.art} hat in dieser Seite keine Adresse`)
    return
  }
  if (!weg.ausfuehren) {
    console.error(`[Story-Sektion] Ziel ${ziel.art} hat nur eine Adresse (${weg.href}), keinen Wechsel — der Beleg oeffnet nichts`)
    return
  }
  weg.ausfuehren()
}

export function useWebsiteStoryNavigation(navigation: WebsiteNavigation, onClose: () => void, oeffneLokal?: OeffneLokal) {
  // `{}` = der ganze Katalog, `{ doc }` = ein Dokument — wie vor WE3 die Adress-Parameter.
  const zurGalerie = useCallback(
    (extra: { doc?: string }) => wegGehen(navigation, extra.doc ? { art: 'dokument', slug: extra.doc } : { art: 'galerie' }),
    [navigation],
  )

  const nav = useMemo<GalleryNavigation>(
    () => ({
      openDocument: (slug, opts) => {
        if (oeffneLokal?.(slug, opts?.page)) return
        if (oeffneLokal) console.warn(`[Story-Sektion] Dokument "${slug}" ist hier nicht geladen — oeffne es in der Galerie`)
        zurGalerie({ doc: slug })
      },
      closeDocument: onClose,
      // Leer = kein Teilen-Knopf (Vertrag des Kontexts).
      documentShareUrl: () => '',
      params: new URLSearchParams(),
      replaceParams: () => nichtVorgesehen('replaceParams'),
      pushParams: () => nichtVorgesehen('pushParams'),
      applyModeParams: () => nichtVorgesehen('applyModeParams'),
    }),
    [zurGalerie, onClose, oeffneLokal],
  )

  return { zurGalerie, nav }
}
