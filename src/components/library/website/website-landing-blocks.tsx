/**
 * Render-Bausteine fuer den Webseiten-Renderer: Markdown-Text, Inhalts-Sektion,
 * Video-Embed. Bewusst Server-Component (kein 'use client') fuer schnelle
 * Ladezeit im Phase-0-Pilot.
 */

import * as React from 'react'
import type { WebsiteSection } from '@/lib/website/types'
import { md } from '@/components/library/markdown-preview/md-renderer'
import { cn } from '@/lib/utils'
import { isSafeVideoIframeSrc } from '@/lib/media/safe-video-iframe'

/**
 * Pro Hintergrund-Variante: `wrapper` (Section-Hintergrund + Basis-Textfarbe) und
 * `prose` (zusaetzliche Typografie-/Farb-Overrides fuer den Markdown-Container).
 * Die konkreten Toene entsprechen der Vorlage „Oldies for Future".
 */
const SECTION_STYLE: Record<WebsiteSection['bg'], { wrapper: string; prose: string }> = {
  default: { wrapper: 'bg-background text-foreground', prose: '' },
  light: { wrapper: 'bg-muted text-foreground', prose: '' },
  dark: { wrapper: 'bg-slate-900 text-slate-50', prose: 'prose-invert' },
  // Teal (generischer Brand-Ton) – helle Schrift, Linen-Ueberschrift, Mint-Absaetze.
  brand: { wrapper: 'bg-[#006b55] text-white', prose: 'prose-invert prose-headings:text-[#ebe4dd] [&_p]:text-[#6fc5ae]' },
  // Linen: heller warmer Ton, dunkle Schrift, Ueberschrift in Primary-Gruen.
  linen: { wrapper: 'bg-[#ebe4dd] text-[#202020]', prose: 'prose-headings:text-[#16ad8c]' },
  // Mint: helles Gruen, dunkle Schrift, weisse Ueberschrift.
  mint: { wrapper: 'bg-[#6fc5ae] text-[#0b3a30]', prose: 'prose-headings:text-white [&_p]:text-[#0b3a30]' },
  // Dunkelgruen: helle Schrift, Linen-Ueberschrift, Mint-Absaetze.
  'dark-green': { wrapper: 'bg-[#005140] text-white', prose: 'prose-invert prose-headings:text-[#ebe4dd] [&_p]:text-[#6fc5ae]' },
  // Neutralgrau (Video-Sektion): dunkle Schrift, dunkelgruene Ueberschrift.
  neutral: { wrapper: 'bg-[#bfc9c3] text-[#202020]', prose: 'prose-headings:text-[#005140]' },
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
export function renderMarkdownText(markdown: string, bg: WebsiteSection['bg']): React.ReactElement {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none',
        // Vorlage-Optik (`.h-serif-medium`): Ueberschrift NORMAL (400, nicht fett),
        // capitalize, ~2.35rem; Lead-Absatz (erster) etwas groesser.
        'prose-headings:font-normal prose-h2:mb-2.5 prose-h2:leading-snug prose-h2:text-[2rem] md:prose-h2:text-[2.35rem] [&_h2]:capitalize',
        '[&_p:first-of-type]:text-lg [&_p:first-of-type]:leading-relaxed md:[&_p:first-of-type]:text-xl',
        // Farb-/Invert-Overrides je Hintergrund-Variante (zentral in SECTION_STYLE).
        SECTION_STYLE[bg].prose,
      )}
      dangerouslySetInnerHTML={{ __html: md.render(markdown) }}
    />
  )
}

/** Eine Inhalts-Sektion gemaess Layout/Hintergrund. */
export function SectionBlock({ section }: { section: WebsiteSection }): React.ReactElement | null {
  const hasImage = Boolean(section.imageUrl) && section.layout !== 'text-only'
  const twoCol = section.layout === 'image-left' || section.layout === 'image-right'
  const imageFirst = section.layout === 'image-left'

  // Video-Sektion: sicheres Embed (nur Whitelist-URLs) im bg-abhaengigen Rahmen.
  if (section.layout === 'video') {
    const safeVideo =
      section.videoUrl && isSafeVideoIframeSrc(section.videoUrl) ? section.videoUrl : null
    return (
      <section className={`px-6 py-14 ${SECTION_STYLE[section.bg].wrapper}`}>
        <div className="mx-auto max-w-4xl">
          {section.markdown && (
            <div className="mb-6">{renderMarkdownText(section.markdown, section.bg)}</div>
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
    <section className={`py-14 px-6 ${SECTION_STYLE[section.bg].wrapper}`}>
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
          {renderMarkdownText(section.markdown, section.bg)}
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
