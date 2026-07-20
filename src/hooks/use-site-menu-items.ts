"use client"

/**
 * Website-Menuepunkte fuer die TopNav (Phase C1b).
 *
 * Im Site-Kontext (Explore-Slug mit `siteEnabled` oder host-gemappte
 * Domain-Root) wandern die dokumentgetriebenen Website-Seiten (z. B.
 * „Kontakt") als NavItems in die TopNav — statt einer zweiten Menue-Leiste
 * unter der Bar (Doppelmenue war fuer Anwender irrefuehrend).
 *
 * Das Homepage-Doc (kleinster `menu_order`) wird bewusst WEGGELASSEN:
 * es ist identisch mit dem TopNav-Punkt „Home".
 *
 * Datenpfad wie `SiteLogo`/`WebsiteLandingLive`: libraryId aus dem Jotai-Atom
 * (eingeloggt) oder der oeffentlichen Slug-API (anonym, 60s-Cache serverseitig),
 * dann die oeffentliche Docs-API (`detailViewType=website`, lokalisiert).
 */

import * as React from "react"
import { useAtomValue } from "jotai"
import { libraryAtom } from "@/atoms/library-atom"
import { fetchDocs } from "@/components/library/website/use-website-landing-data"
import { selectMainMenuDocs, getSiteParamForDoc } from "@/lib/website/site-navigation"
import type { NavItem } from "@/components/top-nav-config"

/**
 * Liefert die Website-Seiten (ohne Homepage-Doc) als NavItems.
 *
 * @param slug   Library-Slug im Site-Kontext, sonst `null` (Hook liefert dann `[]`).
 * @param baseHref Basis-URL der Website (`/` auf der Domain-Root, sonst `/explore/<slug>`).
 * @param locale Anzeige-Sprache (Menue-Labels kommen lokalisiert von der Docs-API).
 */
export function useSiteMenuItems(
  slug: string | null,
  baseHref: string | null,
  locale: string,
): NavItem[] {
  const { libraries } = useAtomValue(libraryAtom)
  // Eingeloggt: libraryId direkt aus dem Atom (spart den Slug-API-Roundtrip).
  const atomLibraryId =
    libraries.find((lib) => lib.config?.publicPublishing?.slugName === slug)?.id ?? null

  const [items, setItems] = React.useState<NavItem[]>([])

  React.useEffect(() => {
    if (!slug || !baseHref) {
      setItems([])
      return
    }
    let cancelled = false

    async function load(theSlug: string, theBaseHref: string): Promise<void> {
      try {
        let libraryId = atomLibraryId
        if (!libraryId) {
          const res = await fetch(`/api/public/libraries/${encodeURIComponent(theSlug)}`)
          if (!res.ok) return
          const json = await res.json()
          libraryId = typeof json?.library?.id === "string" ? json.library.id : null
        }
        if (!libraryId) return

        const docs = await fetchDocs(libraryId, "detailViewType=website&limit=50", locale)
        if (cancelled) return
        // Erstes Main-Menue-Doc = Homepage (kleinster menu_order) -> entspricht „Home".
        const pages = selectMainMenuDocs(docs).slice(1)
        setItems(
          pages.flatMap((d) => {
            const param = getSiteParamForDoc(d)
            if (!param) return []
            return [
              {
                name: d.title ?? d.fileName ?? param,
                href: `${theBaseHref}?site=${encodeURIComponent(param)}`,
              },
            ]
          }),
        )
      } catch (e) {
        // Menue ist Progressive Enhancement — Fehler laut loggen, Nav nicht blockieren.
        console.error("[useSiteMenuItems] Website-Menue konnte nicht geladen werden:", e)
      }
    }

    void load(slug, baseHref)
    return () => {
      cancelled = true
    }
  }, [slug, baseHref, locale, atomLibraryId])

  return items
}
