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
import {
  type HeadingCase,
  type WebsiteSection,
  OLDIES_THEME,
  type SiteThemeResolved,
  KICKER_CLASS,
  surfaceStyle,
  type WebsiteNavigation,
} from '..'
import { cn } from '@ks/util'
import { isSafeVideoIframeSrc } from '@ks/util'
import { SectionContent } from './section-content'


/** Eine Inhalts-Sektion gemaess Layout/Hintergrund. */
export function SectionBlock({
  section,
  headingCase = 'capitalize',
  theme = OLDIES_THEME,
  navigation,
}: {
  section: WebsiteSection
  headingCase?: HeadingCase
  theme?: SiteThemeResolved
  /** N2: wohin Kachel-Links fuehren (`<!-- cards -->`). */
  navigation?: WebsiteNavigation
}): React.ReactElement | null {
  const hasImage = Boolean(section.imageUrl) && section.layout !== 'text-only'
  const twoCol = section.layout === 'image-left' || section.layout === 'image-right'
  const imageFirst = section.layout === 'image-left'
  // Bildspalte und Ausrichtung (Marker-Attribute image_width, image_align):
  // `1/3` = ein Drittel Bild, zwei Drittel Text; `top` = obenbuendig statt mittig.
  const schmal = section.imageWidth === '1/3'
  const oben = section.imageAlign === 'top'
  const flaeche = surfaceStyle(section.bg, theme)
  const kicker = section.kicker ? <p className={KICKER_CLASS}>{section.kicker}</p> : null

  // Video-Sektion: sicheres Embed (nur Whitelist-URLs) im bg-abhaengigen Rahmen.
  if (section.layout === 'video') {
    const safeVideo =
      section.videoUrl && isSafeVideoIframeSrc(section.videoUrl) ? section.videoUrl : null
    return (
      <section className={cn('px-4 py-10 sm:px-6 sm:py-14', flaeche.className)} style={flaeche.style}>
        <div className="mx-auto max-w-4xl">
          {kicker}
          {section.markdown && (
            <div className="mb-6"><SectionContent blocks={section.blocks} bg={section.bg} headingCase={headingCase} theme={theme} navigation={navigation} /></div>
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
    <section className={cn('px-4 py-10 sm:px-6 sm:py-14', flaeche.className)} style={flaeche.style}>
      <div
        className={cn(
          'max-w-5xl mx-auto gap-10',
          oben ? 'items-start' : 'items-center',
          twoCol && hasImage ? (schmal ? 'grid md:grid-cols-3' : 'grid md:grid-cols-2') : 'flex flex-col',
        )}
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
          className={cn(
            twoCol && hasImage
              ? imageFirst
                ? 'md:order-2'
                : 'md:order-1'
              : 'mx-auto max-w-3xl',
            twoCol && hasImage && schmal ? 'md:col-span-2' : null,
          )}
        >
          {kicker}
          <SectionContent blocks={section.blocks} bg={section.bg} headingCase={headingCase} theme={theme} navigation={navigation} />
        </div>
      </div>
    </section>
  )
}

/** Eingebettetes Web-Video (PeerTube/YouTube/Vimeo). */
export function VideoEmbed({ url }: { url: string }): React.ReactElement {
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
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
