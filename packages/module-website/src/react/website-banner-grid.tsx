"use client"

/**
 * Dokument-Raster der Website-Landingpage („Mehr aus dieser Bibliothek").
 *
 * Welle S1: aus `website-landing-live.tsx` herausgezogen und um die drei
 * Frontmatter-Felder `banner_tag`, `banner_title`, `banner_limit` erweitert.
 * Holt die Karten aus der oeffentlichen Docs-API (`sort=rating`, optional
 * `tags=`), Website-Docs werden entfernt. Rendert an der Stelle, an der es
 * eingebaut wird: unter der Seite (Vorgabe) oder in einer `banner`-Sektion.
 *
 * WE2: Karten und „mehr Inhalte" fuehren ueber die Navigation-Schnittstelle
 * (Ziel `dokument` bzw. `galerie` mit der Liste des Banners); Abrufe ueber
 * die Instanz. Kein Router, keine Explore-Adressen mehr im Baustein.
 */

import * as React from "react"
import { DocumentCard } from "@ks/module-explorer/react"
import type { InstanceApi } from "@ks/api-client"
import { cn, getEffectiveDocumentNavigationSlug } from "@ks/util"
import type { DocCardMeta } from "@ks/contracts"
import { fetchDocs } from "./use-website-landing-data"
import {
  bannerListe,
  bannerQuery,
  type BannerSort,
  OLDIES_THEME,
  type SiteThemeResolved,
  BUTTON_STRONG,
  HEADING_FONT,
  surfaceStyle,
  SECTION_WIDTH,
  wegFehltMelden,
  type WebsiteNavigation,
} from ".."
import { WegLink } from "./weg-link"

interface WebsiteBannerGridProps {
  instanz: InstanceApi
  libraryId: string
  locale: string
  /** Facetten-Filter `tags=<tag>` (Frontmatter `banner_tag`). */
  tag?: string
  /** Ueberschrift (Frontmatter `banner_title`); leer = Standardtext. */
  title?: string
  /** Kartenzahl (Frontmatter `banner_limit`, geprueft in `bannerLimitAus`). */
  limit: number
  /** Reihung (Frontmatter `banner_sort`, F3/ADR 0012): `rating` oder `stars`. */
  sort?: BannerSort
  /** Wohin Karten und „mehr Inhalte" fuehren. */
  navigation: WebsiteNavigation
  /**
   * Sterne und Kommentare an den Karten bedienbar (die Karte bekommt die
   * Library). Die App setzt es im Site-Modus; auf der Root-Seite bleiben sie
   * reine Anzeige wie vor WE2.
   */
  sterneAnKarten: boolean
  /** WE4 (Entscheid A): Karte oeffnet die Detailansicht ueber der Seite statt des Wegs (Embed). */
  onDokument?: (doc: DocCardMeta) => void
  moreLinkLabel: string
  /** Welle S2: Flaeche `light` und Akzent aus dem Profil. */
  theme?: SiteThemeResolved
}

const STANDARD_TITEL = "Mehr aus dieser Bibliothek"

export function WebsiteBannerGrid({
  instanz, libraryId, locale, tag, title, limit, sort = "rating", navigation, sterneAnKarten, onDokument, moreLinkLabel, theme = OLDIES_THEME,
}: WebsiteBannerGridProps): React.ReactElement | null {
  const flaeche = surfaceStyle("light", theme)
  const [docs, setDocs] = React.useState<DocCardMeta[]>([])

  React.useEffect(() => {
    let cancelled = false
    fetchDocs(instanz, libraryId, bannerQuery({ tag, limit, sort }), locale)
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
  }, [instanz, libraryId, locale, tag, limit, sort])

  if (docs.length === 0) {
    if (tag) console.warn(`[website-banner] Kein Dokument traegt das Tag "${tag}" — Raster bleibt leer`)
    if (sort === "stars") console.warn("[website-banner] banner_sort stars: noch kein Eintrag mit Stern (oder starCountsPublic ist aus) — Raster bleibt leer")
    return null
  }

  // „Alle ansehen" nimmt dieselbe Reihung mit: bei `stars` die ganze Rangliste.
  const liste = bannerListe(sort)
  const zurGalerie = navigation.weg({ art: "galerie", liste })
  if (zurGalerie === null) wegFehltMelden("Galerie hat in dieser Seite keine Adresse — „mehr Inhalte\" entfaellt")

  return (
    <section className={cn("px-4 py-12 sm:px-6", flaeche.className)} style={flaeche.style}>
      <div className={SECTION_WIDTH}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className={cn("text-2xl font-semibold text-[color:var(--site-heading)]", HEADING_FONT)}>{title || STANDARD_TITEL}</h2>
          {zurGalerie && (
            <WegLink weg={zurGalerie} className="whitespace-nowrap text-sm font-medium text-[color:var(--site-accent-strong)] hover:underline">
              {moreLinkLabel} →
            </WegLink>
          )}
        </div>
        {/* Drei Spalten auf ~325 px: die Karten laufen in der kompakten Form (nur Titel, Status, Sterne). */}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {docs.map((d) => (
            onDokument
              ? <DocumentCard key={d.fileId ?? d.id} doc={d} libraryId={sterneAnKarten ? libraryId : undefined} cardDensity="compact" onOpen={() => onDokument(d)} />
              : <BannerKarte key={d.fileId ?? d.id} doc={d} liste={liste} navigation={navigation} libraryId={sterneAnKarten ? libraryId : undefined} />
          ))}
        </div>
        {/* Galerie-Link nach dem Raster wiederholen — der dezente Link oben wird leicht uebersehen. */}
        {zurGalerie && (
          <div className="mt-8 flex justify-center">
            <WegLink weg={zurGalerie} className={BUTTON_STRONG}>
              {moreLinkLabel} →
            </WegLink>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Eine Karte des Rasters. Der Klick bringt die Liste mit, in der der Eintrag
 * liegt (bei `stars` die Rangliste) — sonst findet die Galerie nur Eintraege
 * der ersten Seite. Ohne Rueckruf des Wegs traegt ein umschliessender Link
 * die Adresse; ohne Weg bleibt die Karte reine Anzeige (gemeldet).
 */
function BannerKarte({ doc, liste, navigation, libraryId }: {
  doc: DocCardMeta
  liste: ReturnType<typeof bannerListe>
  navigation: WebsiteNavigation
  libraryId?: string
}): React.ReactElement {
  const slug = getEffectiveDocumentNavigationSlug(doc) ?? ""
  const weg = navigation.weg({ art: "dokument", slug, liste })
  if (weg === null) {
    wegFehltMelden("Dokument hat in dieser Seite keine Adresse — Banner-Karten oeffnen nichts")
    return <DocumentCard doc={doc} libraryId={libraryId} cardDensity="compact" onOpen={() => undefined} />
  }
  const { ausfuehren } = weg
  if (ausfuehren) return <DocumentCard doc={doc} libraryId={libraryId} cardDensity="compact" onOpen={() => ausfuehren()} />
  return (
    <a href={weg.href} className="block">
      {/* Die Adresse traegt der Link; die Karte selbst tut beim Klick nichts. */}
      <DocumentCard doc={doc} libraryId={libraryId} cardDensity="compact" onOpen={() => undefined} />
    </a>
  )
}
