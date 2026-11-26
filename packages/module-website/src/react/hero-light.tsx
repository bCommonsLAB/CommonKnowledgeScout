"use client"

/**
 * Heller Kopf (`hero_tone: light` am Standard-Kopf mit Bild, 26.11.2026): das
 * Bild liegt ohne Schleier hinter dem Text und ist am rechten Rand
 * ausgerichtet, der Text steht linksbuendig und senkrecht mittig in den
 * linken drei Fuenfteln — fuer helle, gestaltete Hintergruende, deren Motiv
 * rechts liegt. Unter `md` laeuft der Text ueber die volle Breite.
 *
 * Farben aus dem Profil: Titel im Akzent, Unterzeile in der Textfarbe der
 * Flaeche `default`; der Handlungsaufruf ist ein eckiger, gefuellter Balken im
 * Akzent. Ohne `cta_url` bleibt der Balken eine reine Kennzeile (kein Link).
 * Hat die Flaeche `default` keine Farbwerte im Profil, stehen Weiss und
 * Fast-Schwarz fest — der helle Kopf folgt dem Bild, nicht dem Dark-Mode.
 */

import * as React from "react"
import { cn } from "@ks/util"
import { HEADING_FONT, OLDIES_THEME, SECTION_WIDTH, heroHellBildPosition, type SiteThemeResolved, type WebsiteNavigation } from ".."
import { AutorenLink } from "./weg-link"

interface HeroLightProps {
  title: string
  subtitle?: string
  imageUrl: string
  imageAlt?: string
  /** CSS-`object-position` aus `hero_image_position` (`50% <hoehe>`); nur die Hoehe zaehlt, waagrecht gilt der rechte Rand. */
  imagePosition?: string
  ctaLabel?: string
  ctaUrl?: string
  theme?: SiteThemeResolved
  navigation?: WebsiteNavigation
}

/** Eckiger, gefuellter Balken im Akzent — als Link und als Kennzeile gleich. */
const BALKEN = "inline-block bg-[color:var(--site-accent)] px-4 py-2 text-base font-bold leading-snug text-[color:var(--site-accent-text)] md:text-lg"

export function HeroLight({ title, subtitle, imageUrl, imageAlt, imagePosition, ctaLabel, ctaUrl, theme = OLDIES_THEME, navigation }: HeroLightProps): React.ReactElement {
  const flaeche = theme.surfaces.default
  return (
    <header
      className={cn("relative overflow-hidden", !flaeche && "bg-white text-neutral-900")}
      style={flaeche ? { backgroundColor: flaeche.bg, color: flaeche.text } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={imageAlt ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: heroHellBildPosition(imagePosition) }}
      />
      <div className="relative flex min-h-[50vh] items-center px-4 py-12 sm:px-6">
        <div className={SECTION_WIDTH}>
          <div className="md:w-3/5">
            <h1 className={cn("text-5xl font-bold leading-[1.05] tracking-tight text-[color:var(--site-accent)] md:text-7xl", HEADING_FONT)}>{title}</h1>
            {subtitle && <p className="mt-4 text-xl font-bold leading-snug md:text-3xl">{subtitle}</p>}
            {ctaLabel && (
              <div className="mt-6">
                {ctaUrl ? (
                  <AutorenLink href={ctaUrl} navigation={navigation} className={cn(BALKEN, "transition-colors hover:bg-[color:var(--site-accent-hover)]")}>
                    {ctaLabel}
                  </AutorenLink>
                ) : (
                  <p className={BALKEN}>{ctaLabel}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
