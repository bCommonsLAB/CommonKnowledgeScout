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
 * Bewusst NICHT: relative Bildpfade auf `streaming-url` umschreiben (die Route
 * verlangt eine Anmeldung, siehe `03-audit-embed-fetches.md`) und die
 * Werkzeugleiste der Archiv-Vorschau (Kopieren, Suche, Vollbild).
 *
 * @module components/book-detail
 */

import { useMemo } from 'react'
import { md, injectPageAnchors } from '@ks/viewers'
import type { BookMarkdownProps } from './book-detail'

/** Wie `stripAllFrontmatter` in `src/lib/markdown/frontmatter.ts`: nur Bloecke am Dokumentanfang. */
const FRONTMATTER_AM_ANFANG = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function ohneFrontmatter(text: string): string {
  let out = text
  while (FRONTMATTER_AM_ANFANG.test(out)) out = out.replace(FRONTMATTER_AM_ANFANG, '')
  return out
}

export function MarkdownBody({ content, className }: BookMarkdownProps) {
  const html = useMemo(() => md.render(injectPageAnchors(ohneFrontmatter(content))), [content])
  // Der Inhalt kommt aus der Library der Instanz — wie in der App mit `html: true` gerendert.
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
