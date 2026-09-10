'use client'

/**
 * @fileoverview `next/image` hinter dem Bild-Vertrag der Galerie — Prop fuer Prop durchgereicht.
 *
 * @description
 * Der Gastgeber der Voll-App (`AppGalleryHost`) rendert Galerie-Bilder damit.
 * Seit M5 auch die App-Huellen der Paket-Ansichten, die ausserhalb der Galerie
 * laufen (Buch-Ansicht und Anhang-Liste im Archiv, in der Inbox, im Wizard).
 * Optimiert ueber `/_next/image` und die `remotePatterns` in `next.config.js`.
 *
 * @module providers
 */

import Image from 'next/image'
import type { GalleryImageProps } from '@ks/module-explorer/react'

export function NextBild({ src, alt, className, fill, width, height, loading, unoptimized, onError }: GalleryImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      loading={loading}
      unoptimized={unoptimized}
      onError={onError}
    />
  )
}
