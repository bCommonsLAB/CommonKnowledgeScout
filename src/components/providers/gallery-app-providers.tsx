'use client'

/**
 * @fileoverview Alles, was die Galerie in der Voll-App braucht — an einer Stelle.
 *
 * @description
 * Die Galerie fragt drei Dinge bei ihrer Umgebung nach: wer zuschaut
 * (`GalleryViewer`, sitzt global im Wurzel-Layout), wie adressiert wird
 * (`GalleryNavigation`) und wer der Gastgeber ist (`GalleryHost` — Job-
 * Meldungen, Bilder). Die letzten beiden gehoeren an jeden Montagepunkt.
 *
 * Lehre aus #248: Nach Welle #234 fehlte der Adressierungs-Anbieter an zwei
 * Stellen ausserhalb der Galerie, und oldiesforfuture.org war zehn Tage kaputt.
 * Wer seither eine Galerie-Karte irgendwo zeigt, setzt GENAU DIESE Huelle —
 * nicht zwei einzelne Anbieter, die man halb vergessen kann.
 * `karte-ausserhalb-galerie.test.ts` prueft, dass jede Aufrufstelle sie hat.
 *
 * @module providers
 */

import type { ReactNode } from 'react'
import { NextGalleryNavigation } from './next-gallery-navigation'
import { AppGalleryHost } from './app-gallery-host'

export function GalleryAppProviders({ children }: { children: ReactNode }) {
  return (
    <NextGalleryNavigation>
      <AppGalleryHost>{children}</AppGalleryHost>
    </NextGalleryNavigation>
  )
}
