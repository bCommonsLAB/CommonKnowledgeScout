/**
 * Markdown-Text einer Sektion im `prose`-Container (Welle S3 aus
 * `website-landing-blocks.tsx` herausgezogen, damit Blockfolge und
 * Sektions-Baustein ihn ohne Ringimport teilen).
 *
 * WE2: Mit Navigation laufen die Links des HTML ueber `WebsiteNavigation`
 * (`markdownLinksUeberNavigation`); ein normaler Klick auf einen Weg mit
 * Rueckruf wechselt ohne Neuladen. Ohne Navigation (Archiv-Vorschau, Pilot)
 * bleibt das HTML wie vorher.
 */

import * as React from 'react'
import {
  type HeadingCase,
  type WebsiteSection,
  OLDIES_THEME,
  type SiteThemeResolved,
  surfaceStyle,
  markdownLinksUeberNavigation,
  type WebsiteNavigation,
} from '..'
import { md } from '@ks/viewers'
import { cn } from '@ks/util'
import { istPlainClick } from './weg-link'

/**
 * Gerendertes Markdown als HTML-Element. Mit Navigation werden die Links
 * umgeschrieben und Klicks auf Wege mit Rueckruf abgefangen.
 */
export function MarkdownHtml({ markdown, className, navigation }: {
  markdown: string
  className?: string
  navigation?: WebsiteNavigation
}): React.ReactElement {
  const html = md.render(markdown)
  if (!navigation) return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  const { html: mitWegen, klicks } = markdownLinksUeberNavigation(html, navigation)
  const onClick = klicks.size === 0 ? undefined : (e: React.MouseEvent<HTMLDivElement>) => {
    const anker = e.target instanceof Element ? e.target.closest('a') : null
    const ausfuehren = anker ? klicks.get(anker.getAttribute('href') ?? '') : undefined
    if (ausfuehren && istPlainClick(e)) {
      e.preventDefault()
      ausfuehren()
    }
  }
  return <div className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: mitWegen }} />
}

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
  navigation?: WebsiteNavigation,
): React.ReactElement {
  return (
    <MarkdownHtml
      markdown={markdown}
      navigation={navigation}
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
    />
  )
}
