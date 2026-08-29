'use client'

import React from 'react'
import { GalleryRoot, type GalleryRootProps } from '@/components/library/gallery/gallery-root'
import { NextGalleryNavigation } from '@/components/providers/next-gallery-navigation'

/**
 * Montagepunkt der Galerie in der Voll-App.
 *
 * Hier — und nicht im Wurzel-Layout — wird die Adressierung hereingereicht:
 * Nur die Galerie braucht sie, und `useSearchParams` im Wurzel-Layout wuerde
 * jede Seite dynamisch machen. Beide Routen (`/library/gallery` und
 * `/explore/[slug]`) montieren ueber diese Datei.
 */
export default function GalleryClient(props: GalleryRootProps = {}) {
  return (
    <NextGalleryNavigation>
      <GalleryRoot {...props} />
    </NextGalleryNavigation>
  )
}
