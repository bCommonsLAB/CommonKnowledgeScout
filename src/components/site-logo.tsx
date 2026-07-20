"use client"

/**
 * Website-Logo in der TopNav (Phase C2) — nur im Site-Kontext (Explore-Slug
 * oder host-gemappte Domain-Root).
 *
 * Layout wie in der Webflow-Vorlage: Das Logo ist HOEHER als die 64px-Bar und
 * ueberlappt den Folgeabschnitt (absolute Positionierung, z-Index ueber der
 * Bar). Der Wrapper reserviert nur die BREITE im Flex-Layout, sodass die
 * Nav-Items nach rechts ruecken — ohne Logo-URL rendert die Komponente nichts
 * (aktueller Zustand bleibt).
 *
 * Quelle der Logo-URL: `publicPublishing.logoUrl` der aktiven Library aus dem
 * Jotai-Atom (Explore-Seite laedt sie dorthin). Auf der Domain-Root ist das
 * Atom fuer anonyme Besucher leer — dann wird die oeffentliche Slug-API
 * gefragt (60s-Cache serverseitig).
 */

import * as React from "react"
import Link from "next/link"
import { useAtomValue } from "jotai"
import { libraryAtom } from "@/atoms/library-atom"

interface SiteLogoProps {
  /** Slug der Site-Library (exploreContext.slug bzw. siteRootSlug). */
  slug: string
  /** Home-Ziel: `/` auf der Domain-Root, sonst `/explore/<slug>`. */
  homeHref: string
}

export function SiteLogo({ slug, homeHref }: SiteLogoProps): React.ReactElement | null {
  const { libraries } = useAtomValue(libraryAtom)
  const atomLibrary = libraries.find(
    (lib) => lib.config?.publicPublishing?.slugName === slug,
  )
  const atomLogoUrl = atomLibrary?.config?.publicPublishing?.logoUrl ?? null

  const [fetchedLogoUrl, setFetchedLogoUrl] = React.useState<string | null>(null)

  // Fallback fuer die Domain-Root (Atom leer): oeffentliche Slug-API fragen.
  React.useEffect(() => {
    if (atomLibrary) return
    let cancelled = false
    fetch(`/api/public/libraries/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) return null
        const json = await res.json()
        const url = json?.library?.logoUrl
        return typeof url === "string" && url.length > 0 ? url : null
      })
      .then((url) => {
        if (!cancelled) setFetchedLogoUrl(url)
      })
      .catch((e) => {
        // Logo ist optional — Fehler laut loggen, Navigation nicht blockieren.
        console.error("[SiteLogo] Logo-URL konnte nicht geladen werden:", e)
      })
    return () => {
      cancelled = true
    }
  }, [slug, atomLibrary])

  const logoUrl = atomLogoUrl ?? fetchedLogoUrl
  if (!logoUrl) return null

  return (
    // Breiten-Platzhalter im Flex-Layout; das Bild selbst ist absolut,
    // hoeher als die Bar (h-24 > 64px) und ueberlappt den Inhalt darunter.
    <div className="relative mr-2 hidden w-28 self-start sm:block">
      <Link href={homeHref} className="absolute left-0 top-2 z-[60] block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Logo"
          className="h-24 w-auto max-w-[7rem] object-contain drop-shadow-sm"
        />
      </Link>
    </div>
  )
}
