/**
 * @fileoverview Bericht ueber die Website einer Library (B5) — reine Funktion.
 *
 * @description
 * Die Vorschau ohne Browser: Was hier sauber ist, rendert die Landingpage.
 * Nutzt dieselben Regeln wie der Renderer (`site-navigation.ts`,
 * `parse-website-sections.ts`), keine zweite Implementierung.
 *
 * @module mcp
 */

import type { DocCardMeta } from '@ks/contracts'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import {
  findFooterContentDoc,
  resolveSiteParamDoc,
  selectFooterLinkDocs,
  selectMainMenuDocs,
} from '@/lib/website/site-navigation'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import { bildUrls } from './website-pruefung'

export interface SeitenEintrag {
  fileId: string
  titel: string
  navigationSlug: string | null
  menu_order?: number
  menu_area?: string
  site_role?: string
  sektionen: Array<{ layout: string; bg: string; bild: boolean }>
  fehler: string[]
  warnungen: string[]
}

export interface SeitenBericht {
  startseite: string | null
  menue: string[]
  footerLinks: string[]
  footerDoc: string | null
  seiten: SeitenEintrag[]
  hinweise: string[]
}

const SITE_LINK_RE = /\(\?site=([^)&\s]+)\)/g
const ANONYM_LESBAR = /^https?:\/\//i

function titel(doc: DocCardMeta): string {
  return doc.title ?? doc.fileName ?? doc.fileId ?? '(ohne Titel)'
}

/**
 * Baut den Bericht aus den website-Docs und ihrem Markdown (`docMetaJson.markdown`).
 * Fehlt das Markdown eines Docs, ist das ein Befund am Doc, kein Abbruch.
 */
export function baueSeitenBericht(
  docs: DocCardMeta[],
  markdownJeFileId: Map<string, string | undefined>,
): SeitenBericht {
  const hauptmenue = selectMainMenuDocs(docs)
  const hinweise: string[] = []
  if (docs.length === 0) hinweise.push('Keine website-Docs publiziert — die Landingpage bleibt leer')
  if (docs.length > 0 && hauptmenue.length === 0) {
    hinweise.push('Kein Doc im Hauptmenue (menu_area main) — es gibt keine Startseite')
  }

  const seiten: SeitenEintrag[] = docs.map((doc) => {
    const fileId = doc.fileId ?? ''
    const fehler: string[] = []
    const warnungen: string[] = []
    const markdown = markdownJeFileId.get(fileId)
    let sektionen: SeitenEintrag['sektionen'] = []
    if (typeof markdown !== 'string' || !markdown.trim()) {
      fehler.push('Kein Markdown im Meta-Dokument — Seite rendert leer')
    } else {
      try {
        sektionen = parseWebsiteSections(markdown).map((s) => ({ layout: s.layout, bg: s.bg, bild: Boolean(s.imageUrl) }))
      } catch (error) {
        fehler.push(`Sektions-Marker: ${error instanceof Error ? error.message : String(error)}`)
      }
      for (const url of bildUrls(markdown)) {
        if (!ANONYM_LESBAR.test(url)) warnungen.push(`Bild "${url}" ist nicht anonym ladbar`)
      }
      for (const treffer of markdown.matchAll(SITE_LINK_RE)) {
        const ziel = decodeURIComponent(treffer[1])
        if (!resolveSiteParamDoc(docs, ziel)) fehler.push(`Link ?site=${ziel} trifft kein website-Doc`)
      }
    }
    if (doc.menu_order === undefined) warnungen.push('menu_order fehlt — Doc steht am Ende des Menues')
    return {
      fileId,
      titel: titel(doc),
      navigationSlug: getEffectiveDocumentNavigationSlug(doc),
      menu_order: doc.menu_order,
      menu_area: doc.menu_area,
      site_role: doc.site_role,
      sektionen,
      fehler,
      warnungen,
    }
  })

  const footerDoc = findFooterContentDoc(docs)
  return {
    startseite: hauptmenue[0] ? titel(hauptmenue[0]) : null,
    menue: hauptmenue.map(titel),
    footerLinks: selectFooterLinkDocs(docs).map(titel),
    footerDoc: footerDoc ? titel(footerDoc) : null,
    seiten,
    hinweise,
  }
}
