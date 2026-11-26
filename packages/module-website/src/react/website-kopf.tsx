"use client"

/**
 * Kopf einer Website-Seite: waehlt die Variante nach `hero_layout`
 * (`none`, `band`, `campaign`, `cover`, sonst der Standard-Kopf `overlay`) und
 * am Standard-Kopf mit Bild nach `hero_tone` (`light` = ohne Schleier,
 * `hero-light.tsx`). Bis 26.11.2026 stand die Auswahl in `website-detail.tsx`.
 */

import * as React from "react"
import { cn } from "@ks/util"
import { BUTTON_PRIMARY, type SiteThemeResolved, type WebsiteDetailData, type WebsiteNavigation } from ".."
import { HeroBand } from "./hero-band"
import { HeroCampaign } from "./hero-campaign"
import { HeroCover } from "./hero-cover"
import { HeroLight } from "./hero-light"
import { AutorenLink } from "./weg-link"

interface WebsiteKopfProps {
  data: WebsiteDetailData
  theme: SiteThemeResolved
  /** Wohin die Handlungsaufrufe fuehren; fehlt sie (Archiv-Vorschau), bleiben es rohe Links. */
  navigation?: WebsiteNavigation
}

export function WebsiteKopf({ data, theme, navigation }: WebsiteKopfProps): React.ReactElement | null {
  const heroTitle = data.heroTitle ?? data.title
  if (data.heroLayout === "none") return null
  return data.heroLayout === "band" ? (
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
  ) : data.heroImageUrl && data.heroTone === "light" ? (
    <HeroLight
      title={heroTitle}
      subtitle={data.heroSubtitle}
      imageUrl={data.heroImageUrl}
      imageAlt={data.heroImageAlt}
      imagePosition={data.heroImagePosition}
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
  )
}
