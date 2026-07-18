"use client"

import * as React from "react"
import { ArrowLeft } from "lucide-react"
import { parseWebsiteSections } from "@/lib/website/parse-website-sections"
import { isSafeVideoIframeSrc } from "@/lib/media/safe-video-iframe"
import { SectionBlock, VideoEmbed } from "@/components/library/website/website-landing-blocks"
import { cn } from "@/lib/utils"

/** Detail-Daten fuer detailViewType `website` (Landingpage als Dokument). */
export interface WebsiteDetailData {
  title: string
  heroSubtitle?: string
  heroImageUrl?: string
  heroImageAlt?: string
  /**
   * Hero-Variante (Frontmatter `hero_layout`):
   * - `overlay` (Default): Bild full-bleed mit dunklem Overlay + zentriertem Text.
   * - `cover`: helle Flaeche, grosser gestapelter Titel, kleineres ueberlagertes Bild.
   */
  heroLayout?: string
  videoUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Markdown-Body mit Sektions-Markern (siehe parse-website-sections). */
  markdown?: string
  fileId?: string
  fileName?: string
  upsertedAt?: string
}

interface WebsiteDetailProps {
  data: WebsiteDetailData
  showBackLink?: boolean
}

/**
 * Detailansicht fuer detailViewType `website`.
 *
 * Rendert Hero (Bild + Titel + Subtitel + CTA), die Inhalts-Sektionen aus dem
 * Markdown-Body (Sektions-Marker) und ein eingebettetes Video — letzteres nur,
 * wenn die URL eine sichere Embed-URL ist (kein relativer Dateiname im iframe).
 */
export function WebsiteDetail({ data, showBackLink = false }: WebsiteDetailProps): React.ReactElement {
  const sections = React.useMemo(
    () => (data.markdown ? parseWebsiteSections(data.markdown) : []),
    [data.markdown],
  )
  const embeddableVideo =
    data.videoUrl && isSafeVideoIframeSrc(data.videoUrl) ? data.videoUrl : undefined

  return (
    <div className="w-full">
      {showBackLink && (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="m-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
      )}

      {data.heroLayout === "cover" && data.heroImageUrl ? (
        /* Cover-Variante (Vorlage „Oldies for Future"): helle Flaeche, grosser
           gestapelter Titel (wortweise), kleineres, vom Titel ueberlagertes Bild. */
        <header className="relative overflow-hidden bg-[#ebe4dd] px-6 pt-16 pb-10 md:pt-24 md:pb-16">
          <div className="relative mx-auto max-w-6xl">
            {/* Bild DAHINTER (z-0): rechts, vertikal zentriert — wird vom grossen
               Titel ueberlagert (Vorlage-Optik). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.heroImageUrl}
              alt={data.heroImageAlt ?? ""}
              className="pointer-events-none absolute right-0 top-1/2 z-0 hidden w-[44%] -translate-y-1/2 rounded-lg object-cover shadow-sm md:block"
            />
            {/* Bildschirmfuellender Titel (vw-basiert, ~26vh der Vorlage). Basis-Gewicht
               normal (400); nur Wort 2 („for") bold, Wort 1 („Oldies") kursiv. */}
            <h1 className="relative z-10 text-[16vw] font-normal uppercase leading-[0.8] tracking-tight text-[#16ad8c] md:text-[19vw]">
              {data.title
                .split(/\s+/)
                .filter(Boolean)
                .map((word, i) => (
                  <span
                    key={i}
                    className={cn("block", i === 0 && "italic", i === 1 && "font-bold")}
                  >
                    {word}
                  </span>
                ))}
            </h1>
            {/* Mobile: Bild unter dem Titel (kein Overlap). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.heroImageUrl}
              alt={data.heroImageAlt ?? ""}
              className="mt-6 w-full rounded-lg object-cover md:hidden"
            />
            {data.ctaLabel && data.ctaUrl && (
              <a
                href={data.ctaUrl}
                className="relative z-10 mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500"
              >
                {data.ctaLabel}
              </a>
            )}
          </div>
        </header>
      ) : data.heroImageUrl ? (
        <header className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroImageUrl}
            alt={data.heroImageAlt ?? ""}
            className="h-[50vh] w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center text-white">
            <h1 className="text-4xl font-bold md:text-5xl">{data.title}</h1>
            {data.heroSubtitle && <p className="mt-4 max-w-2xl text-lg">{data.heroSubtitle}</p>}
            {data.ctaLabel && data.ctaUrl && (
              <a
                href={data.ctaUrl}
                className="mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-medium hover:bg-emerald-500"
              >
                {data.ctaLabel}
              </a>
            )}
          </div>
        </header>
      ) : (
        <header className="px-6 py-10 text-center">
          <h1 className="text-3xl font-bold">{data.title}</h1>
          {data.heroSubtitle && <p className="mt-3 text-muted-foreground">{data.heroSubtitle}</p>}
        </header>
      )}

      {sections.map((s, i) => (
        <SectionBlock key={i} section={s} />
      ))}
      {embeddableVideo && <VideoEmbed url={embeddableVideo} />}
    </div>
  )
}
