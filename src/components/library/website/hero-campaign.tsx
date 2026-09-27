"use client"

/**
 * Hero-Variante `campaign` (Welle S2, Zielbild Steckbrief 5): Bild oben,
 * abgerundet mit Schatten und einer Kennzeile im Bild; darunter links der
 * Titel in der Ueberschriften-Schrift mit optionaler kursiver Zweitzeile
 * (`hero_title2`) und der Unterzeile, rechts ein primaerer und ein zweiter
 * Handlungsaufruf (`cta2_label`, `cta2_url`). Flaeche `default` des Profils.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { OLDIES_THEME, type SiteThemeResolved } from "@/lib/website/site-theme"
import { BUTTON_PRIMARY, BUTTON_SECONDARY, HEADING_FONT, surfaceStyle } from "@/lib/website/surface-style"

interface HeroCampaignProps {
  title: string
  title2?: string
  subtitle?: string
  kicker?: string
  imageUrl: string
  imageAlt?: string
  ctaLabel?: string
  ctaUrl?: string
  cta2Label?: string
  cta2Url?: string
  theme?: SiteThemeResolved
}

export function HeroCampaign({
  title, title2, subtitle, kicker, imageUrl, imageAlt, ctaLabel, ctaUrl, cta2Label, cta2Url, theme = OLDIES_THEME,
}: HeroCampaignProps): React.ReactElement {
  const flaeche = surfaceStyle("default", theme)
  const buttons = (ctaLabel && ctaUrl) || (cta2Label && cta2Url)

  return (
    <header className={cn("px-6 pt-8 pb-12 md:pt-12 md:pb-16", flaeche.className)} style={flaeche.style}>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-2xl shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAlt ?? ""} className="aspect-[16/9] w-full object-cover md:aspect-[21/9]" />
          {kicker && (
            <p className="absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm md:bottom-6 md:left-6">
              {kicker}
            </p>
          )}
        </div>
        <div className={cn("mt-8 md:mt-12 md:grid md:items-end md:gap-10", buttons && "md:grid-cols-[minmax(0,1fr)_auto]")}>
          <div className="max-w-3xl">
            <h1 className={cn("text-4xl font-normal leading-[1.1] tracking-tight text-[color:var(--site-heading)] md:text-6xl", HEADING_FONT)}>
              {title}
              {title2 && (
                <>
                  <br />
                  <em className="italic">{title2}</em>
                </>
              )}
            </h1>
            {subtitle && <p className="mt-6 max-w-2xl text-base leading-relaxed opacity-85 md:text-lg">{subtitle}</p>}
          </div>
          {buttons && (
            <div className="mt-8 flex flex-wrap gap-3 md:mt-0 md:justify-end">
              {ctaLabel && ctaUrl && <a href={ctaUrl} className={BUTTON_PRIMARY}>{ctaLabel}</a>}
              {cta2Label && cta2Url && <a href={cta2Url} className={BUTTON_SECONDARY}>{cta2Label}</a>}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
