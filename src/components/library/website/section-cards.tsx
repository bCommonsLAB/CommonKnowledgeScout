/**
 * Kacheln einer Sektion (Welle N2, Plan website-story-sektion): der Block
 * `<!-- cards -->` — Titel, Text, Link, drei nebeneinander ab `md`.
 *
 * Die Karte sieht aus wie `box kind=card` (weiss, Schatten, dunkle Schrift).
 * Wohin ein Klick fuehrt, loest `kartenziel.ts` auf: im Site-Modus wechselt
 * ein Rueckruf die Ansicht ohne Neuladen, im Root-Modus (und ohne Rueckrufe)
 * bleibt es ein Link. Ein unbekanntes Ziel zeigt die Karte sichtbar als
 * Fehler statt eines toten Links (der Parser wirft es schon beim Lesen).
 */

import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CardItem } from '@/lib/website/parse-section-blocks'
import { kartenaktion, loeseKartenziel, type Kartenaktion, type KartenNavigation } from '@/lib/website/kartenziel'
import { HEADING_FONT } from '@/lib/website/surface-style'

/** Normaler Linksklick (ohne Umschalt-, Strg-, Alt-, Meta-Taste): den Rueckruf nehmen, sonst folgt der Browser dem Link. */
function istPlainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

function Karte({ item, navigation }: { item: CardItem; navigation?: KartenNavigation }): React.ReactElement {
  let aktion: Kartenaktion
  try {
    aktion = kartenaktion(loeseKartenziel(item.href), navigation)
  } catch (error) {
    return (
      <div className="rounded-xl border border-destructive bg-white p-5 text-sm text-destructive shadow-sm" role="alert">
        {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }
  const { ausfuehren } = aktion
  return (
    <div className="group relative flex flex-col rounded-xl bg-white p-5 text-neutral-900 shadow-sm transition-shadow hover:shadow-md" data-website-karte>
      <h3 className={cn('text-lg leading-snug text-neutral-900', HEADING_FONT)}>{item.title}</h3>
      {item.text && <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-700">{item.text}</p>}
      <a
        href={aktion.href}
        target={aktion.extern ? '_blank' : undefined}
        rel={aktion.extern ? 'noopener noreferrer' : undefined}
        onClick={ausfuehren ? (e) => { if (istPlainClick(e)) { e.preventDefault(); ausfuehren() } } : undefined}
        // Der Link deckt die ganze Karte (::after), damit die Flaeche klickbar ist, nicht nur die Zeile.
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--site-accent-strong)] after:absolute after:inset-0 after:content-['']"
      >
        {item.linkLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </a>
    </div>
  )
}

export function Cards({ items, navigation }: { items: CardItem[]; navigation?: KartenNavigation }): React.ReactElement {
  return (
    <div className="not-prose my-6 grid gap-4 md:grid-cols-3">
      {items.map((item, i) => <Karte key={i} item={item} navigation={navigation} />)}
    </div>
  )
}
