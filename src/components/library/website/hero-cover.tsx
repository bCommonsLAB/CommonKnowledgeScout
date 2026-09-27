"use client"

/**
 * Hero-Variante `cover` (Vorlage „Oldies for Future"): helle Flaeche, grosser
 * gestapelter Titel (wortweise), kleineres, vom Titel ueberlagertes Bild.
 *
 * Welle S1: aus `website-detail.tsx` herausgezogen. Zwei Befunde vom
 * 27.09.2026 behoben: der Untertitel (`hero_subtitle`) wurde in dieser
 * Variante nie gerendert, und ein langes einzelnes Wort lief bei 16–19 vw
 * ueber den Rand — die Groesse haengt jetzt am laengsten Wort.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { coverTitelGroesseVw } from "@/lib/website/banner"

interface HeroCoverProps {
  title: string
  subtitle?: string
  imageUrl: string
  imageAlt?: string
  ctaLabel?: string
  ctaUrl?: string
}

export function HeroCover({ title, subtitle, imageUrl, imageAlt, ctaLabel, ctaUrl }: HeroCoverProps): React.ReactElement {
  const woerter = title.split(/\s+/).filter(Boolean)
  const groesseVw = coverTitelGroesseVw(title)

  return (
    <header className="relative overflow-hidden bg-[#ebe4dd] px-6 pt-16 pb-10 md:pt-24 md:pb-16">
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
          className="relative z-10 break-words font-normal uppercase leading-[0.8] tracking-tight text-[#16ad8c]"
          style={{ fontSize: `${Math.min(groesseVw, 16)}vw` }}
        >
          {woerter.map((wort, i) => (
            <span key={i} className={cn("block md:text-[var(--cover-md)]", i === 0 && "italic", i === 1 && "font-bold")} style={{ ["--cover-md" as string]: `${groesseVw}vw` }}>
              {wort}
            </span>
          ))}
        </h1>
        {subtitle && (
          <p className="relative z-10 mt-6 max-w-2xl text-lg leading-relaxed text-[#202020] md:text-xl">{subtitle}</p>
        )}
        {/* Mobile: Bild unter dem Titel (kein Overlap). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={imageAlt ?? ""} className="mt-6 w-full rounded-lg object-cover md:hidden" />
        {ctaLabel && ctaUrl && (
          <a href={ctaUrl} className="relative z-10 mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-500">
            {ctaLabel}
          </a>
        )}
      </div>
    </header>
  )
}
