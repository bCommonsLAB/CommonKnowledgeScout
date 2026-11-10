"use client"

/**
 * Hero-Variante `band` (Welle N4): ein schlankes farbiges Band mit Kennzeile,
 * Titel und Unterzeile — ohne grosses Bild; ein `hero_image` liegt nur als
 * Hintergrund hinter dem Text und macht das Band nicht hoeher. Fuer Startseiten, die zuerst die
 * Frage stellen wollen: der Banner traegt den Titel, bleibt aber niedrig, damit
 * die Story-Sektion gleich darunter sichtbar ist (Figma S1, Wunsch „wie Hero,
 * aber nicht so hoch").
 *
 * Flaeche: der kraeftige Akzent des Profils (`--site-accent-strong`), Text in
 * `--site-accent-text` — beide immer gesetzt (siteThemeCssVars), also auch fuer
 * Libraries ohne eigene `brand`-Flaeche robust. Titel in der Ueberschriften-
 * Schrift des Profils.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { HEADING_FONT } from "@/lib/website/surface-style"

interface HeroBandProps {
  title: string
  subtitle?: string
  kicker?: string
  /** Optionales Hintergrundbild (`hero_image`): liegt hinter dem Text, die Hoehe des Bands bleibt. */
  imageUrl?: string
  imageAlt?: string
}

export function HeroBand({ title, subtitle, kicker, imageUrl, imageAlt }: HeroBandProps): React.ReactElement {
  return (
    <header
      className={cn(
        "relative overflow-hidden bg-[color:var(--site-accent-strong)] px-6 py-10 md:py-14",
        // Mit Bild: weisser Text auf dunklem Schleier — die Akzent-Textfarbe ist nur fuer die Akzentflaeche gedacht.
        imageUrl ? "text-white" : "text-[color:var(--site-accent-text)]",
      )}
    >
      {imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={imageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 bg-black/45" />
        </>
      )}
      <div className="relative mx-auto max-w-4xl text-center">
        {kicker && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] opacity-80">{kicker}</p>
        )}
        <h1 className={cn("text-3xl font-normal leading-[1.12] tracking-tight md:text-5xl", HEADING_FONT)}>{title}</h1>
        {subtitle && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed opacity-90 md:text-lg">{subtitle}</p>}
      </div>
    </header>
  )
}
