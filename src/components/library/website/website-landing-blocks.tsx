/**
 * Render-Bausteine fuer den Webseiten-Renderer: Markdown-Text, Inhalts-Sektion,
 * Video-Embed. Bewusst Server-Component (kein 'use client') fuer schnelle
 * Ladezeit im Phase-0-Pilot.
 */

import * as React from 'react'
import type { WebsiteSection } from '@/lib/website/types'
import { md } from '@/components/library/markdown-preview/md-renderer'
import { cn } from '@/lib/utils'

const BG_CLASS: Record<WebsiteSection['bg'], string> = {
  default: 'bg-background text-foreground',
  light: 'bg-muted text-foreground',
  dark: 'bg-slate-900 text-slate-50',
  brand: 'bg-emerald-700 text-emerald-50',
}

/**
 * Rendert den Sektions-Markdown ueber den App-weiten Remarkable-Renderer (`md`)
 * in einem `prose`-Container: Ueberschriften, Absaetze, Listen, Links, Fett,
 * Blockquotes, Zeilenumbrueche (md ist mit `breaks`+`linkify` konfiguriert).
 *
 * `invert` (helle Schrift auf dunklem/brand-Hintergrund) nutzt `prose-invert`.
 * Inhalt ist kuratiert/uebersetzt (vertrauenswuerdig) — gleiches Muster wie
 * die MarkdownPreview-Komponente.
 */
export function renderMarkdownText(markdown: string, invert = false): React.ReactElement {
  return (
    <div
      className={cn('prose prose-neutral max-w-none', invert && 'prose-invert')}
      dangerouslySetInnerHTML={{ __html: md.render(markdown) }}
    />
  )
}

/** Eine Inhalts-Sektion gemaess Layout/Hintergrund. */
export function SectionBlock({ section }: { section: WebsiteSection }): React.ReactElement {
  const hasImage = Boolean(section.imageUrl) && section.layout !== 'text-only'
  const twoCol = section.layout === 'image-left' || section.layout === 'image-right'
  const imageFirst = section.layout === 'image-left'
  // Helle Schrift auf dunklem/brand-Hintergrund -> prose-invert.
  const invert = section.bg === 'dark' || section.bg === 'brand'

  return (
    <section className={`py-14 px-6 ${BG_CLASS[section.bg]}`}>
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
          {renderMarkdownText(section.markdown, invert)}
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
