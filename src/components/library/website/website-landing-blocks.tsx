/**
 * Render-Bausteine fuer den Webseiten-Renderer: Markdown-Text, Inhalts-Sektion,
 * Video-Embed. Bewusst Server-Component (kein 'use client') fuer schnelle
 * Ladezeit im Phase-0-Pilot.
 *
 * Welle S2: Farben und Schriften kommen aus dem aufgeloesten Design-Profil
 * (`site-theme.ts`, `surface-style.ts`) statt aus einer festen Tabelle. Ohne
 * Profil rendert alles wie die Vorlage „Oldies for Future".
 */

import * as React from 'react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import { cn } from '@/lib/utils'
import { isSafeVideoIframeSrc } from '@/lib/media/safe-video-iframe'
import { OLDIES_THEME, type SiteThemeResolved } from '@/lib/website/site-theme'
import { KICKER_CLASS, surfaceStyle } from '@/lib/website/surface-style'
import { SectionContent } from './section-content'

// S3: `renderMarkdownText` wohnt in `markdown-text.tsx` (Bestandsimporte bleiben gueltig).
export { renderMarkdownText } from './markdown-text'

/** Eine Inhalts-Sektion gemaess Layout/Hintergrund. */
export function SectionBlock({
  section,
  headingCase = 'capitalize',
  theme = OLDIES_THEME,
}: {
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
}): React.ReactElement | null {
  const hasImage = Boolean(section.imageUrl) && section.layout !== 'text-only'
  const twoCol = section.layout === 'image-left' || section.layout === 'image-right'
  const imageFirst = section.layout === 'image-left'
  const flaeche = surfaceStyle(section.bg, theme)
  const kicker = section.kicker ? <p className={KICKER_CLASS}>{section.kicker}</p> : null

  // Video-Sektion: sicheres Embed (nur Whitelist-URLs) im bg-abhaengigen Rahmen.
  if (section.layout === 'video') {
    const safeVideo =
      section.videoUrl && isSafeVideoIframeSrc(section.videoUrl) ? section.videoUrl : null
    return (
      <section className={cn('px-6 py-14', flaeche.className)} style={flaeche.style}>
        <div className="mx-auto max-w-4xl">
          {kicker}
          {section.markdown && (
            <div className="mb-6"><SectionContent blocks={section.blocks} bg={section.bg} headingCase={headingCase} theme={theme} /></div>
          )}
          {safeVideo && (
            <div className="aspect-video overflow-hidden rounded-xl bg-black/10">
              <iframe
                src={safeVideo}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                title="Video"
              />
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className={cn('py-14 px-6', flaeche.className)} style={flaeche.style}>
      <div
        className={`max-w-5xl mx-auto gap-10 items-center ${
          twoCol && hasImage ? 'grid md:grid-cols-2' : 'flex flex-col'
        }`}
      >
        {hasImage && section.layout === 'full-image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={section.imageUrl}
            alt={section.imageAlt ?? ''}
            loading="lazy"
            className="w-full rounded-xl object-cover aspect-[21/9]"
          />
        )}
        {twoCol && hasImage && (
          <div className={imageFirst ? 'md:order-1' : 'md:order-2'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={section.imageUrl}
              alt={section.imageAlt ?? ''}
              loading="lazy"
              className="w-full rounded-xl object-cover aspect-[4/3]"
            />
          </div>
        )}
        <div
          className={
            twoCol && hasImage
              ? imageFirst
                ? 'md:order-2'
                : 'md:order-1'
              : 'mx-auto max-w-3xl'
          }
        >
          {kicker}
          <SectionContent blocks={section.blocks} bg={section.bg} headingCase={headingCase} theme={theme} />
        </div>
      </div>
    </section>
  )
}

/** Eingebettetes Web-Video (PeerTube/YouTube/Vimeo). */
export function VideoEmbed({ url }: { url: string }): React.ReactElement {
  return (
    <section className="py-14 px-6">
      <div className="max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden bg-muted">
        <iframe
          src={url}
          className="w-full h-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          title="Video"
        />
      </div>
    </section>
  )
}
