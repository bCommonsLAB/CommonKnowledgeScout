'use client'

/**
 * @fileoverview Was die Galerie ihrem Gastgeber sagen kann — und was sie von ihm braucht.
 *
 * @description
 * Vier Stellen in der Galerie schrieben direkt in `jobMonitorPanelOpenAtom`,
 * um nach einem angestossenen Hintergrund-Job die Werkbank-Anzeige
 * aufzuklappen. Der Job-Monitor ist aber Werkbank, nicht Galerie — die
 * Galerie hat kein Geschaeft damit, fremde Bedienflaechen zu oeffnen
 * (Galerie-Audit, Gruppe B). Sie sagt nur noch, DASS etwas laeuft.
 *
 * Welle M4f fuegt die zweite Frage an den Gastgeber hinzu: **womit Bilder
 * gerendert werden.** Fuenf Galerie-Dateien holten `next/image`. Das kann im
 * Paket nicht bleiben — es braucht den Next-Server (`/_next/image`) und die
 * `remotePatterns` der App; in einer fremden Seite gibt es beides nicht. Die
 * Galerie sagt jetzt nur: „hier ein Bild, so gross". Womit, entscheidet der
 * Gastgeber:
 *
 * - **Voll-App** (`AppGalleryHost`): `next/image`, optimiert wie bisher.
 * - **Embed** (`STILLER_GASTGEBER`): ein schlichtes `<img>`.
 *
 * Beides ohne Rueckgabewert bzw. ohne Rueckfrage: Die Galerie darf nicht
 * davon abhaengen, WIE der Gastgeber reagiert.
 *
 * @module contexts
 */

import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

/**
 * Was die Galerie ueber ein Bild sagt. Zugeschnitten auf die fuenf
 * Aufrufstellen, nicht auf `next/image`: entweder `fill` (fuellt den
 * positionierten Elternrahmen) oder feste `width`/`height`.
 */
export interface GalleryImageProps {
  src: string
  alt: string
  className?: string
  /** Fuellt den Elternrahmen (der muss `position: relative` sein). */
  fill?: boolean
  width?: number
  height?: number
  loading?: 'lazy' | 'eager'
  /**
   * Hinweis an einen optimierenden Gastgeber, das Bild unveraendert zu
   * liefern (z. B. Thumbnails, die schon klein sind). Ein `<img>` kennt das
   * nicht und ignoriert es.
   */
  unoptimized?: boolean
  onError?: () => void
}

export interface GalleryHost {
  /**
   * Ein Hintergrund-Job wurde angestossen. Der Gastgeber darf Fortschritt
   * zeigen — muss aber nicht.
   */
  jobGestartet(): void
  /** Womit der Gastgeber Bilder rendert. */
  Bild: ComponentType<GalleryImageProps>
}

/** Ein Bild ohne Optimierung — was jede Seite kann. */
export function SchlichtesBild({ src, alt, className, fill, width, height, loading, onError }: GalleryImageProps) {
  // Bewusst kein `next/image`: Dieser Renderer ist die rahmenneutrale Basis
  // fuer Umgebungen ohne Next-Server. Die App reicht ihren eigenen herein.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={loading}
      onError={onError}
      // Dieselbe Geometrie, die `next/image` bei `fill` per Inline-Stil setzt.
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%' } : undefined}
    />
  )
}

/** Gastgeber, der nichts anzuzeigen hat und Bilder schlicht rendert — der Normalfall im Embed. */
export const STILLER_GASTGEBER: GalleryHost = {
  jobGestartet: () => {},
  Bild: SchlichtesBild,
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
        'Gastgeber. In der App liefert ihn GalleryAppProviders ' +
        '(src/components/providers/gallery-app-providers.tsx), im Embed STILLER_GASTGEBER.'
    )
  }
  return host
}
