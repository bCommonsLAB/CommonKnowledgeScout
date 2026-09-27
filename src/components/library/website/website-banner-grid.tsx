"use client"

/**
 * Dokument-Raster der Website-Landingpage („Mehr aus dieser Bibliothek").
 *
 * Welle S1: aus `website-landing-live.tsx` herausgezogen und um die drei
 * Frontmatter-Felder `banner_tag`, `banner_title`, `banner_limit` erweitert.
 * Holt die Karten aus der oeffentlichen Docs-API (`sort=rating`, optional
 * `tags=`), Website-Docs werden entfernt. Rendert an der Stelle, an der es
 * eingebaut wird: unter der Seite (Vorgabe) oder in einer `banner`-Sektion.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { DocumentCard } from "@ks/module-explorer/react"
import { getEffectiveDocumentNavigationSlug } from "@ks/util"
import type { DocCardMeta } from "@ks/contracts"
import { fetchDocs } from "@/components/library/website/use-website-landing-data"
import { bannerQuery } from "@/lib/website/banner"

interface WebsiteBannerGridProps {
  libraryId: string
  locale: string
  /** Facetten-Filter `tags=<tag>` (Frontmatter `banner_tag`). */
  tag?: string
  /** Ueberschrift (Frontmatter `banner_title`); leer = Standardtext. */
  title?: string
  /** Kartenzahl (Frontmatter `banner_limit`, geprueft in `bannerLimitAus`). */
  limit: number
  /** Root-Modus: Galerie-Basis inkl. `?view=gallery`; sonst lokaler Galerie-Modus. */
  galleryBaseHref: string | null
  onShowGallery?: () => void
  moreLinkLabel: string
}

const STANDARD_TITEL = "Mehr aus dieser Bibliothek"

export function WebsiteBannerGrid({
  libraryId, locale, tag, title, limit, galleryBaseHref, onShowGallery, moreLinkLabel,
}: WebsiteBannerGridProps): React.ReactElement | null {
  const router = useRouter()
  const [docs, setDocs] = React.useState<DocCardMeta[]>([])

  React.useEffect(() => {
    let cancelled = false
    fetchDocs(libraryId, bannerQuery({ tag, limit }), locale)
      .then((items) => {
        if (cancelled) return
        setDocs(items.filter((d) => d.detailViewType !== "website").slice(0, limit))
      })
      .catch((e) => {
        // Banner ist optional — ein Fehler darf die Seite nicht blockieren, bleibt aber sichtbar.
        console.error(`[website-banner] Karten konnten nicht geladen werden: ${e instanceof Error ? e.message : String(e)}`)
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, locale, tag, limit])

  if (docs.length === 0) {
    if (tag) console.warn(`[website-banner] Kein Dokument traegt das Tag "${tag}" — Raster bleibt leer`)
    return null
  }

  const zurGalerie = () => (galleryBaseHref ? router.push(galleryBaseHref) : onShowGallery?.())

  return (
    <section className="bg-muted px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">{title || STANDARD_TITEL}</h2>
          <button type="button" onClick={zurGalerie} className="whitespace-nowrap text-sm font-medium text-emerald-700 hover:underline">
            {moreLinkLabel} →
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {docs.map((d) =>
            galleryBaseHref ? (
              // Root-Modus: Karte navigiert in die Explore-Galerie (Detail-Overlay dort).
              <DocumentCard
                key={d.fileId ?? d.id}
                doc={d}
                onClick={() => router.push(`${galleryBaseHref}&doc=${getEffectiveDocumentNavigationSlug(d) ?? ""}`)}
              />
            ) : (
              <DocumentCard key={d.fileId ?? d.id} doc={d} libraryId={libraryId} />
            ),
          )}
        </div>
        {/* Galerie-Link nach dem Raster wiederholen — der dezente Link oben wird leicht uebersehen. */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={zurGalerie}
            className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800"
          >
            {moreLinkLabel} →
          </button>
        </div>
      </div>
    </section>
  )
}
