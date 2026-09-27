"use client"

/**
 * Hero-Variante `cover` (Vorlage „Oldies for Future"): helle Flaeche, grosser
 * gestapelter Titel (wortweise), kleineres, vom Titel ueberlagertes Bild.
 *
 * Welle S1: aus `website-detail.tsx` herausgezogen. Zwei Befunde vom
 * 27.09.2026 behoben: der Untertitel (`hero_subtitle`) wurde in dieser
 * Variante nie gerendert, und ein langes einzelnes Wort lief bei 16–19 vw
 * ueber den Rand — die Groesse haengt jetzt am laengsten Wort.
 * Welle S2: Flaeche und Farben aus dem Profil (Flaeche `linen`: Hintergrund,
 * Titel = Ueberschriftfarbe, Untertitel = Textfarbe), Button ueber Akzent.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { coverTitelGroesseVw } from "@/lib/website/banner"
import { OLDIES_THEME, type SiteThemeResolved } from "@/lib/website/site-theme"
import { BUTTON_PRIMARY, HEADING_FONT, surfaceStyle } from "@/lib/website/surface-style"

interface HeroCoverProps {
  title: string
  subtitle?: string
  imageUrl: string
  imageAlt?: string
  ctaLabel?: string
  ctaUrl?: string
  theme?: SiteThemeResolved
}

export function HeroCover({ title, subtitle, imageUrl, imageAlt, ctaLabel, ctaUrl, theme = OLDIES_THEME }: HeroCoverProps): React.ReactElement {
  const woerter = title.split(/\s+/).filter(Boolean)
  const groesseVw = coverTitelGroesseVw(title)
  const flaeche = surfaceStyle("linen", theme)

  return (
    <header className={cn("relative overflow-hidden px-6 pt-16 pb-10 md:pt-24 md:pb-16", flaeche.className)} style={flaeche.style}>
      <div className="relative mx-auto max-w-6xl">
        {/* Bild DAHINTER (z-0): rechts, vertikal zentriert — wird vom grossen Titel ueberlagert. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt ?? ""}
          className="pointer-events-none absolute right-0 top-1/2 z-0 hidden w-[44%] -translate-y-1/2 rounded-lg object-cover shadow-sm md:block"
        />
        {/* Gestapelter Titel: Basis-Gewicht normal, Wort 1 kursiv, Wort 2 fett (Vorlage-Optik).
            Groesse in vw, begrenzt durch das laengste Wort — `break-words` als zweite Sicherung. */}
        <h1
          className={cn("relative z-10 break-words font-normal uppercase leading-[0.8] tracking-tight text-[color:var(--site-heading)]", HEADING_FONT)}
          style={{ fontSize: `${Math.min(groesseVw, 16)}vw` }}
        >
          {woerter.map((wort, i) => (
            <span key={i} className={cn("block md:text-[var(--cover-md)]", i === 0 && "italic", i === 1 && "font-bold")} style={{ ["--cover-md" as string]: `${groesseVw}vw` }}>
              {wort}
            </span>
          ))}
        </h1>
        {subtitle && (
          <p className="relative z-10 mt-6 max-w-2xl text-lg leading-relaxed md:text-xl">{subtitle}</p>
        )}
        {/* Mobile: Bild unter dem Titel (kein Overlap). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={imageAlt ?? ""} className="mt-6 w-full rounded-lg object-cover md:hidden" />
        {ctaLabel && ctaUrl && (
          <a href={ctaUrl} className={cn(BUTTON_PRIMARY, "relative z-10 mt-6")}>
            {ctaLabel}
          </a>
        )}
      </div>
    </header>
  )
}
