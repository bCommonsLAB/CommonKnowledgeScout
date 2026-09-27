"use client"

import * as React from "react"
import { ArrowLeft } from "lucide-react"
import { parseWebsiteSections } from "@/lib/website/parse-website-sections"
import type { HeadingCase } from "@/lib/website/types"
import { isSafeVideoIframeSrc } from "@/lib/media/safe-video-iframe"
import { SectionBlock, VideoEmbed } from "@/components/library/website/website-landing-blocks"
import { SectionContent } from "@/components/library/website/section-content"
import { WebsiteContactFormSection } from "@/components/library/website/website-contact-form"
import { HeroCover } from "@/components/library/website/hero-cover"
import { HeroCampaign } from "@/components/library/website/hero-campaign"
import { OLDIES_THEME, siteThemeCssVars, type SiteThemeResolved } from "@/lib/website/site-theme"
import { BUTTON_PRIMARY, KICKER_CLASS, surfaceStyle } from "@/lib/website/surface-style"
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
   * - `campaign` (S2): Bild oben mit Kennzeile, darunter Titel, Zweitzeile, zwei Buttons.
   */
  heroLayout?: string
  videoUrl?: string
  ctaLabel?: string
  ctaUrl?: string
  /** Welle S2, Hero `campaign`: `hero_kicker`, `hero_title2`, `cta2_label`, `cta2_url`. */
  heroKicker?: string
  /** `hero_title`: Ueberschrift des Heros, wenn sie vom Dokument-Titel (Menuepunkt) abweichen soll. */
  heroTitle?: string
  heroTitle2?: string
  cta2Label?: string
  cta2Url?: string
  /** Markdown-Body mit Sektions-Markern (siehe parse-website-sections). */
  markdown?: string
  /**
   * C3: Empfaenger-Adresse des Kontakt-Formulars (Frontmatter `contact_email`).
   * Nur fuer die Aktiv/Inaktiv-Anzeige — der Versand liest sie serverseitig.
   */
  contactEmail?: string
  /** Welle S1: Banner-Steuerung (Frontmatter `banner_tag`, `banner_title`, `banner_limit`). */
  bannerTag?: string
  bannerTitle?: string
  bannerLimit?: number
  /** Welle S1: Schreibweise der Sektions-Ueberschriften (Frontmatter `heading_case`). */
  headingCase?: HeadingCase
  fileId?: string
  fileName?: string
  upsertedAt?: string
}

interface WebsiteDetailProps {
  data: WebsiteDetailData
  showBackLink?: boolean
  /**
   * C3: Library-Slug fuer die oeffentliche Contact-API. Ohne Slug rendert die
   * `contact-form`-Sektion einen Deaktiviert-Hinweis statt des Formulars.
   */
  contactApiSlug?: string | null
  /**
   * Welle S1: das Dokument-Raster, das an der Stelle einer `banner`-Sektion
   * eingesetzt wird. Fehlt es (z. B. Vorschau im Archiv), zeigt die Sektion
   * nur ihre Einleitung.
   */
  bannerSlot?: React.ReactNode
  /** Welle S2: aufgeloestes Design-Profil; fehlt = Vorlage (Archiv-Vorschau). */
  theme?: SiteThemeResolved
}

/** Hat der Body eine `banner`-Sektion? Dann gehoert das Raster dorthin, nicht unter die Seite. */
export function hatBannerSektion(markdown: string | undefined): boolean {
  if (!markdown) return false
  return parseWebsiteSections(markdown).some((s) => s.layout === "banner")
}

/**
 * Detailansicht fuer detailViewType `website`.
 *
 * Rendert Hero (Bild + Titel + Subtitel + CTA), die Inhalts-Sektionen aus dem
 * Markdown-Body (Sektions-Marker) und ein eingebettetes Video — letzteres nur,
 * wenn die URL eine sichere Embed-URL ist (kein relativer Dateiname im iframe).
 */
export function WebsiteDetail({ data, showBackLink = false, contactApiSlug = null, bannerSlot, theme = OLDIES_THEME }: WebsiteDetailProps): React.ReactElement {
  const sections = React.useMemo(
    () => (data.markdown ? parseWebsiteSections(data.markdown) : []),
    [data.markdown],
  )
  const embeddableVideo =
    data.videoUrl && isSafeVideoIframeSrc(data.videoUrl) ? data.videoUrl : undefined
  const headingCase = data.headingCase ?? "capitalize"
  const heroTitle = data.heroTitle ?? data.title
  // S2: Akzent/Radius als Variablen auch ohne den Wrapper der Live-Seite (Archiv-Vorschau).
  const themeVars = React.useMemo(() => siteThemeCssVars(theme) as React.CSSProperties, [theme])

  return (
    <div className="w-full" style={themeVars}>
      {showBackLink && (
        <button
          type="button"
          onClick={() => window.history.back()}
          className="m-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
      )}

      {data.heroLayout === "campaign" && data.heroImageUrl ? (
        <HeroCampaign
          title={heroTitle}
          title2={data.heroTitle2}
          subtitle={data.heroSubtitle}
          kicker={data.heroKicker}
          imageUrl={data.heroImageUrl}
          imageAlt={data.heroImageAlt}
          ctaLabel={data.ctaLabel}
          ctaUrl={data.ctaUrl}
          cta2Label={data.cta2Label}
          cta2Url={data.cta2Url}
          theme={theme}
        />
      ) : data.heroLayout === "cover" && data.heroImageUrl ? (
        <HeroCover
          title={heroTitle}
          subtitle={data.heroSubtitle}
          imageUrl={data.heroImageUrl}
          imageAlt={data.heroImageAlt}
          ctaLabel={data.ctaLabel}
          ctaUrl={data.ctaUrl}
          theme={theme}
        />
      ) : data.heroImageUrl ? (
        <header className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroImageUrl}
            alt={data.heroImageAlt ?? ""}
            className="h-[50vh] w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center text-white">
            <h1 className="text-4xl font-bold md:text-5xl">{heroTitle}</h1>
            {data.heroSubtitle && <p className="mt-4 max-w-2xl text-lg">{data.heroSubtitle}</p>}
            {data.ctaLabel && data.ctaUrl && (
              <a href={data.ctaUrl} className={cn(BUTTON_PRIMARY, "mt-6")}>
                {data.ctaLabel}
              </a>
            )}
          </div>
        </header>
      ) : (
        <header className="px-6 py-10 text-center">
          <h1 className="text-3xl font-bold">{heroTitle}</h1>
          {data.heroSubtitle && <p className="mt-3 text-muted-foreground">{data.heroSubtitle}</p>}
        </header>
      )}

      {sections.map((s, i) => {
        if (s.layout === "contact-form") {
          // C3: Kontakt-Formular-Sektion (Versand ueber die Contact-API).
          return (
            <WebsiteContactFormSection
              key={i}
              section={s}
              librarySlug={contactApiSlug}
              fileId={data.fileId}
              contactEmail={data.contactEmail}
              theme={theme}
            />
          )
        }
        if (s.layout === "banner") {
          // S1: Einleitung der Sektion, darunter das Raster an dieser Stelle.
          // S2-Nachtrag: Kennzeile und Flaeche galten hier nicht (Befund Cowork 27.09.).
          const flaeche = surfaceStyle(s.bg, theme)
          return (
            <React.Fragment key={i}>
              {(s.markdown || s.kicker) && (
                <section className={cn("px-6 pt-14", flaeche.className)} style={flaeche.style}>
                  <div className="mx-auto max-w-5xl">
                    {s.kicker && <p className={KICKER_CLASS}>{s.kicker}</p>}
                    {s.markdown && <SectionContent blocks={s.blocks} bg={s.bg} headingCase={headingCase} theme={theme} />}
                  </div>
                </section>
              )}
              {bannerSlot}
            </React.Fragment>
          )
        }
        return <SectionBlock key={i} section={s} headingCase={headingCase} theme={theme} />
      })}
      {embeddableVideo && <VideoEmbed url={embeddableVideo} />}
    </div>
  )
}
