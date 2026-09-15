'use client'

/**
 * @fileoverview Markdown fuer die Buch-Ansicht im Paket — ohne die Archiv-Vorschau.
 *
 * @description
 * Die App rendert Zusammenfassung und Inhalt eines Buches mit `MarkdownPreview`
 * (853 Zeilen, dahinter Speicher-Kontext, Clerk und `next/navigation`, weil
 * sie auch Transformationen und Composite-Transkripte kann). Die Buch-Ansicht
 * braucht davon nur drei Schritte: Frontmatter weg, Seitenanker, rendern.
 * Dieselbe Engine (`md` aus `@ks/viewers`), derselbe Anker-Helfer.
 *
 * Dazu ein vierter Schritt, den die App nicht braucht: `?doc=<slug>`-Links
 * (Anschlusskarten, „passende Karten") oeffnen das Dokument ueber die
 * Adressierung der Galerie statt ueber die Adresszeile — im Embed gibt es
 * keine, ein Klick laedt sonst die fremde Seite neu (`lib/doc-link.ts`).
 * Klicks mit Zusatztaste oder mittlerer Maustaste bleiben dem Browser.
 *
 * Bewusst NICHT: relative Bildpfade auf `streaming-url` umschreiben (die Route
 * verlangt eine Anmeldung, siehe `03-audit-embed-fetches.md`) und die
 * Werkzeugleiste der Archiv-Vorschau (Kopieren, Suche, Vollbild).
 *
 * @module components/book-detail
 */

import { useCallback, useMemo, type MouseEvent } from 'react'
import { md, injectPageAnchors } from '@ks/viewers'
import { useGalleryNavigation } from '../../contexts/gallery-navigation-context'
import { docSlugAusHref } from '../../lib/doc-link'
import type { BookMarkdownProps } from './book-detail'

/** Wie `stripAllFrontmatter` in `src/lib/markdown/frontmatter.ts`: nur Bloecke am Dokumentanfang. */
const FRONTMATTER_AM_ANFANG = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function ohneFrontmatter(text: string): string {
  let out = text
  while (FRONTMATTER_AM_ANFANG.test(out)) out = out.replace(FRONTMATTER_AM_ANFANG, '')
  return out
}

/** Der Link, auf den geklickt wurde — auch wenn der Klick auf ein Kind des Links traf. */
function geklickterLink(ziel: EventTarget | null): HTMLAnchorElement | null {
  if (!(ziel instanceof Element)) return null
  return ziel.closest('a')
}

export function MarkdownBody({ content, className }: BookMarkdownProps) {
  const navigation = useGalleryNavigation()
  const html = useMemo(() => md.render(injectPageAnchors(ohneFrontmatter(content))), [content])

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = geklickterLink(e.target)
      if (!link) return
      const slug = docSlugAusHref(link.getAttribute('href'))
      if (!slug) return
      e.preventDefault()
      navigation.openDocument(slug)
    },
    [navigation],
  )

  // Der Inhalt kommt aus der Library der Instanz — wie in der App mit `html: true` gerendert.
  return <div className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}
