/**
 * Dokumentgetriebene Website-Navigation (Phase C1).
 *
 * Reine Funktionen ueber `DocCardMeta`-Listen (website-Docs einer Library):
 * Menue-Filterung nach den flachen Frontmatter-Feldern `menu_area` /
 * `site_role` sowie Aufloesung des `?site=<slug|fileId>`-Deep-Links.
 *
 * Feld-Semantik (siehe docs/analysis/website-shell-phase-c-analyse.md §2.1):
 * - `menu_area`: `main` (Default) | `footer` | `hidden`
 * - `site_role`: `page` (Default) | `footer-content`
 * Unbekannte Werte verhalten sich bewusst wie `hidden` bzw. `page` — das Doc
 * verschwindet aus den Menues, statt falsch einsortiert zu werden.
 */

import type { DocCardMeta } from '@/lib/gallery/types'
import {
  docMatchesNavigationSlug,
  getEffectiveDocumentNavigationSlug,
} from '@/utils/document-slug'

const MENU_AREA_MAIN = 'main'
const MENU_AREA_FOOTER = 'footer'
const SITE_ROLE_FOOTER_CONTENT = 'footer-content'

/** Sortiert website-Docs nach `menu_order` (fehlend ans Ende), dann Titel. */
export function sortByMenuOrder(a: DocCardMeta, b: DocCardMeta): number {
  const av = typeof a.menu_order === 'number' ? a.menu_order : Number.POSITIVE_INFINITY
  const bv = typeof b.menu_order === 'number' ? b.menu_order : Number.POSITIVE_INFINITY
  if (av !== bv) return av - bv
  return (a.title ?? '').localeCompare(b.title ?? '')
}

/** Doc gehoert ins Top-Menue: `menu_area` fehlt/`main` UND keine Footer-Content-Rolle. */
function isMainMenuDoc(doc: DocCardMeta): boolean {
  if (doc.site_role === SITE_ROLE_FOOTER_CONTENT) return false
  return doc.menu_area === undefined || doc.menu_area === MENU_AREA_MAIN
}

/** Doc wird nur im Website-Footer verlinkt (`menu_area: footer`). */
function isFooterLinkDoc(doc: DocCardMeta): boolean {
  if (doc.site_role === SITE_ROLE_FOOTER_CONTENT) return false
  return doc.menu_area === MENU_AREA_FOOTER
}

/** Top-Menue-Docs, nach `menu_order` sortiert (kleinster Wert = Homepage). */
export function selectMainMenuDocs(docs: DocCardMeta[]): DocCardMeta[] {
  return docs.filter(isMainMenuDoc).sort(sortByMenuOrder)
}

/** Footer-Link-Docs (Impressum/Datenschutz), nach `menu_order` sortiert. */
export function selectFooterLinkDocs(docs: DocCardMeta[]): DocCardMeta[] {
  return docs.filter(isFooterLinkDoc).sort(sortByMenuOrder)
}

/**
 * Das Footer-Content-Doc (`site_role: footer-content`): seine Sektionen werden
 * als Website-Fusszeile unter jeder Seite gerendert. Bei mehreren Kandidaten
 * gewinnt deterministisch der kleinste `menu_order` (dann Titel).
 */
export function findFooterContentDoc(docs: DocCardMeta[]): DocCardMeta | null {
  const candidates = docs
    .filter((d) => d.site_role === SITE_ROLE_FOOTER_CONTENT)
    .sort(sortByMenuOrder)
  return candidates[0] ?? null
}

/**
 * Loest den `?site=`-Deep-Link auf: erst Navigations-Slug (persistiert oder
 * synthetisch, wie `?doc=`), dann `fileId` als Fallback fuer technische Links.
 * `null` = kein Treffer (Aufrufer entscheidet ueber Fallback + Logging).
 */
export function resolveSiteParamDoc(docs: DocCardMeta[], siteParam: string): DocCardMeta | null {
  const trimmed = siteParam.trim()
  if (!trimmed) return null
  return (
    docs.find((d) => docMatchesNavigationSlug(d, trimmed)) ??
    docs.find((d) => d.fileId === trimmed) ??
    null
  )
}

/** Slug-Wert fuer den `?site=`-Param eines Docs (gleiche Regeln wie `?doc=`). */
export function getSiteParamForDoc(doc: DocCardMeta): string | null {
  return getEffectiveDocumentNavigationSlug(doc)
}
