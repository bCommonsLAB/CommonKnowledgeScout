"use client"

import * as React from "react"
import { ArrowLeft } from "lucide-react"
import {
  parseWebsiteSections,
  type WebsiteDetailData,
  type WebsiteSection,
  type WebsiteNavigation,
  OLDIES_THEME,
  siteThemeCssVars,
  type SiteThemeResolved,
  BUTTON_PRIMARY,
  KICKER_CLASS,
  surfaceStyle,
  SECTION_WIDTH,
} from ".."
import { cn, isSafeVideoIframeSrc } from "@ks/util"
import type { InstanceApi } from "@ks/api-client"
import { SectionBlock, VideoEmbed } from "./website-landing-blocks"
import { SectionContent } from "./section-content"
import { WebsiteContactFormSection } from "./website-contact-form"
import { HeroCover } from "./hero-cover"
import { HeroCampaign } from "./hero-campaign"
import { HeroBand } from "./hero-band"
import { WebsiteStorySektionRahmen } from "./website-story-sektion-rahmen"
import { WebsiteThemenRahmen } from "./website-themen-rahmen"
import { AutorenLink } from "./weg-link"

interface WebsiteDetailProps {
  data: WebsiteDetailData
  showBackLink?: boolean
  /** C3: Slug fuer die Contact-API; ohne Slug zeigt `contact-form` einen Deaktiviert-Hinweis. */
  contactApiSlug?: string | null
  /**
   * Welle S1: das Dokument-Raster an der Stelle einer `banner`-Sektion. Fehlt
   * es (z. B. Vorschau im Archiv), zeigt die Sektion nur ihre Einleitung.
   */
  bannerSlot?: React.ReactNode
  /**
   * Welle N1: der Chat der Library, der an der Stelle einer `story`-Sektion
   * montiert wird (Live-Seite), ebenso die Themenuebersicht (`topics`). Fehlt
   * er (Archiv-Vorschau), zeigt der Rahmen die Fragen als Liste bzw. Hinweis.
   */
  storySlot?: (section: WebsiteSection) => React.ReactNode
  /** N2/WE2: wohin Kacheln, Handlungsaufrufe und Markdown-Links fuehren; fehlt sie (Archiv-Vorschau), reine Links. */
  navigation?: WebsiteNavigation
  /** WE2: Instanz fuer das Kontaktformular; fehlt sie (Archiv-Vorschau), ist es deaktiviert. */
  instanz?: InstanceApi
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
export function WebsiteDetail({ data, showBackLink = false, contactApiSlug = null, bannerSlot, storySlot, navigation, instanz, theme = OLDIES_THEME }: WebsiteDetailProps): React.ReactElement {
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

      {data.heroLayout === "none" ? null : data.heroLayout === "band" ? (
        <HeroBand
          title={heroTitle}
          subtitle={data.heroSubtitle}
          kicker={data.heroKicker}
          imageUrl={data.heroImageUrl}
          imageAlt={data.heroImageAlt}
          imagePosition={data.heroImagePosition}
        />
      ) : data.heroLayout === "campaign" && data.heroImageUrl ? (
        <HeroCampaign
          title={heroTitle}
          title2={data.heroTitle2}
          subtitle={data.heroSubtitle}
          kicker={data.heroKicker}
          imageUrl={data.heroImageUrl}
          imageAlt={data.heroImageAlt}
          imagePosition={data.heroImagePosition}
          ctaLabel={data.ctaLabel}
          ctaUrl={data.ctaUrl}
          cta2Label={data.cta2Label}
          cta2Url={data.cta2Url}
          theme={theme}
          navigation={navigation}
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
          navigation={navigation}
        />
      ) : data.heroImageUrl ? (
        <header className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.heroImageUrl}
            alt={data.heroImageAlt ?? ""}
            className="h-[50vh] w-full object-cover"
            style={data.heroImagePosition ? { objectPosition: data.heroImagePosition } : undefined}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-6 text-center text-white">
            <h1 className="text-4xl font-bold md:text-5xl">{heroTitle}</h1>
            {data.heroSubtitle && <p className="mt-4 max-w-2xl text-lg">{data.heroSubtitle}</p>}
            {data.ctaLabel && data.ctaUrl && (
              <AutorenLink href={data.ctaUrl} navigation={navigation} className={cn(BUTTON_PRIMARY, "mt-6")}>
                {data.ctaLabel}
              </AutorenLink>
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
              instanz={instanz ?? null}
              navigation={navigation}
              fileId={data.fileId}
              contactEmail={data.contactEmail}
              theme={theme}
            />
          )
        }
        if (s.layout === "story" || s.layout === "topics") {
          // N1: der Chat an dieser Stelle (Live-Seite) — oder der Rahmen mit den Fragen als Liste (Vorschau).
          // 18.11.2026: ebenso die Themenuebersicht (`topics`), in der Vorschau nur der Rahmen mit Hinweis.
          const vorschau = s.layout === "story"
            ? <WebsiteStorySektionRahmen section={s} headingCase={headingCase} theme={theme} />
            : <WebsiteThemenRahmen section={s} headingCase={headingCase} theme={theme} />
          return <React.Fragment key={i}>{storySlot ? storySlot(s) : vorschau}</React.Fragment>
        }
        if (s.layout === "banner") {
          // S1: Einleitung der Sektion, darunter das Raster an dieser Stelle.
          // S2-Nachtrag: Kennzeile und Flaeche galten hier nicht (Befund Cowork 27.09.).
          const flaeche = surfaceStyle(s.bg, theme)
          return (
            <React.Fragment key={i}>
              {(s.markdown || s.kicker) && (
                <section className={cn("px-6 pt-14", flaeche.className)} style={flaeche.style}>
                  <div className={SECTION_WIDTH}>
                    {s.kicker && <p className={KICKER_CLASS}>{s.kicker}</p>}
                    {s.markdown && <SectionContent blocks={s.blocks} bg={s.bg} headingCase={headingCase} theme={theme} navigation={navigation} />}
                  </div>
                </section>
              )}
              {bannerSlot}
            </React.Fragment>
          )
        }
        return <SectionBlock key={i} section={s} headingCase={headingCase} theme={theme} navigation={navigation} />
      })}
      {embeddableVideo && <VideoEmbed url={embeddableVideo} />}
    </div>
  )
}
