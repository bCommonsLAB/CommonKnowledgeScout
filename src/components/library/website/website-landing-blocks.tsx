/**
 * Render-Bausteine fuer den Webseiten-Renderer: Markdown-Text, Inhalts-Sektion,
 * Video-Embed. Bewusst Server-Component (kein 'use client') fuer schnelle
 * Ladezeit im Phase-0-Pilot.
 */

import * as React from 'react'
import type { WebsiteSection } from '@/lib/website/types'

const BG_CLASS: Record<WebsiteSection['bg'], string> = {
  default: 'bg-background text-foreground',
  light: 'bg-muted text-foreground',
  dark: 'bg-slate-900 text-slate-50',
  brand: 'bg-emerald-700 text-emerald-50',
}

/** Minimaler Markdown-Renderer (Pilot): Ueberschrift, Zitat, Absatz. */
export function renderMarkdownText(markdown: string): React.ReactNode {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  return blocks.map((block, i) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="text-2xl md:text-3xl font-semibold mb-4">
          {block.slice(3).trim()}
        </h2>
      )
    }
    const lines = block.split('\n')
    if (lines.every((l) => l.trim().startsWith('>'))) {
      const quote = lines.map((l) => l.replace(/^>\s?/, '').trim())
      return (
        <blockquote key={i} className="border-l-4 border-current/40 pl-4 text-xl italic">
          {quote.map((l, j) => (
            <p key={j} className={j === quote.length - 1 ? 'not-italic text-sm mt-2 opacity-80' : ''}>
              {l}
            </p>
          ))}
        </blockquote>
      )
    }
    return (
      <p key={i} className="mb-4 leading-relaxed">
        {block}
      </p>
    )
  })
}

/** Eine Inhalts-Sektion gemaess Layout/Hintergrund. */
export function SectionBlock({ section }: { section: WebsiteSection }): React.ReactElement {
  const hasImage = Boolean(section.imageUrl) && section.layout !== 'text-only'
  const twoCol = section.layout === 'image-left' || section.layout === 'image-right'
  const imageFirst = section.layout === 'image-left'

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
              : 'max-w-3xl mx-auto text-center'
          }
        >
          {renderMarkdownText(section.markdown)}
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
