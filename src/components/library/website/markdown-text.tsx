/**
 * Markdown-Text einer Sektion im `prose`-Container (Welle S3 aus
 * `website-landing-blocks.tsx` herausgezogen, damit Blockfolge und
 * Sektions-Baustein ihn ohne Ringimport teilen).
 */

import * as React from 'react'
import type { HeadingCase, WebsiteSection } from '@/lib/website/types'
import { md } from '@ks/viewers'
import { cn } from '@/lib/utils'
import { OLDIES_THEME, type SiteThemeResolved } from '@/lib/website/site-theme'
import { surfaceStyle } from '@/lib/website/surface-style'

/**
 * Rendert den Sektions-Markdown ueber den App-weiten Remarkable-Renderer (`md`)
 * in einem `prose`-Container: Ueberschriften, Absaetze, Listen, Links, Fett,
 * Blockquotes, Zeilenumbrueche (md ist mit `breaks`+`linkify` konfiguriert).
 *
 * Invert und Farben je Flaeche liefert `surfaceStyle`. Inhalt ist
 * kuratiert/uebersetzt (vertrauenswuerdig) — gleiches Muster wie die
 * MarkdownPreview-Komponente.
 */
export function renderMarkdownText(
  markdown: string,
  bg: WebsiteSection['bg'],
  headingCase: HeadingCase = 'capitalize',
  theme: SiteThemeResolved = OLDIES_THEME,
): React.ReactElement {
  return (
    <div
      className={cn(
        'prose prose-neutral max-w-none',
        // Vorlage-Optik (`.h-serif-medium`): Ueberschrift NORMAL (400, nicht fett),
        // ~2.35rem; Lead-Absatz (erster) etwas groesser. `capitalize` ist die
        // Vorlage-Vorgabe (Steckbrief 10); Frontmatter `heading_case: none` schaltet es ab (S1).
        'prose-headings:font-normal prose-h2:mb-2.5 prose-h2:leading-snug prose-h2:text-[2rem] md:prose-h2:text-[2.35rem]',
        // S2: Ueberschriften-Schrift aus dem Profil (ohne Profil ungesetzt = erbt).
        'prose-headings:font-[family-name:var(--site-font-heading)]',
        headingCase === 'capitalize' && '[&_h2]:capitalize',
        // S3: Zitat mit Randstreifen in Kennzeilen-/Ueberschriftfarbe der Flaeche.
        '[&_blockquote]:border-l-[color:var(--site-kicker)] [&_blockquote]:text-lg',
        '[&_p:first-of-type]:text-lg [&_p:first-of-type]:leading-relaxed md:[&_p:first-of-type]:text-xl',
        surfaceStyle(bg, theme).prose,
      )}
      dangerouslySetInnerHTML={{ __html: md.render(markdown) }}
    />
  )
}
