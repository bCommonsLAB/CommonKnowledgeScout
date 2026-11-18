/**
 * Kacheln einer Sektion (Welle N2, Plan website-story-sektion): der Block
 * `<!-- cards -->` — Titel, Text, Link, drei nebeneinander ab `md`.
 *
 * Die Karte sieht aus wie `box kind=card` (weiss, Schatten, dunkle Schrift).
 * Wohin ein Klick fuehrt, loest `kartenziel.ts` auf; Adresse und Wechsel ohne
 * Neuladen liefert seit WE2 die Navigation-Schnittstelle (`navigation.weg`).
 * Ohne Navigation (Archiv-Vorschau) bleibt es der rohe Link. Ein unbekanntes
 * Ziel zeigt die Karte sichtbar als Fehler statt eines toten Links (der Parser
 * wirft es schon beim Lesen); ein Ziel ohne Weg laesst die Karte weg (gemeldet).
 */

import * as React from 'react'
import {
  ArrowRight, Archive, ListTree, HelpCircle, BookOpen, Search, MapPin, Info, Compass, Leaf, Users, FileText, Calendar, Image, MessageCircle, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@ks/util'
import {
  type CardIconName,
  type CardItem,
  appNavigation,
  loeseKartenziel,
  wegFehltMelden,
  type WebsiteNavigation,
  type WebsiteWeg,
  HEADING_FONT,
} from '..'
import { WegLink } from './weg-link'

/** Welle N4: Karten-Symbole (`:name:`) auf Lucide-Icons. Deckt `CARD_ICON_NAMES` vollstaendig ab (Typpruefung). */
const CARD_ICONS: Record<CardIconName, LucideIcon> = {
  archive: Archive, list: ListTree, help: HelpCircle, book: BookOpen, search: Search, map: MapPin,
  info: Info, compass: Compass, leaf: Leaf, users: Users, file: FileText, calendar: Calendar,
  image: Image, message: MessageCircle, sparkles: Sparkles,
}

/**
 * Der Weg einer Kachel: externe Adressen im neuen Tab, Ziele ueber die
 * Navigation. Ohne Navigation (Archiv-Vorschau) die KnowledgeScout-Adressen
 * ohne Rueckrufe (`appNavigation()`), also reine Links.
 */
function kachelWeg(href: string, navigation: WebsiteNavigation | undefined): { weg: WebsiteWeg | null; extern: boolean } {
  const ziel = loeseKartenziel(href)
  if (ziel.art === 'extern') return { weg: { href: ziel.url }, extern: true }
  const websiteZiel = ziel.art === 'seite' ? { art: 'seite' as const, seite: ziel.slug } : { art: ziel.art }
  const weg = (navigation ?? appNavigation()).weg(websiteZiel)
  if (weg === null) wegFehltMelden(`Kachel-Ziel "${href}" hat in dieser Seite keine Adresse — Kachel entfaellt`)
  return { weg, extern: false }
}

function Karte({ item, navigation }: { item: CardItem; navigation?: WebsiteNavigation }): React.ReactElement | null {
  let aktion: { weg: WebsiteWeg | null; extern: boolean }
  try {
    aktion = kachelWeg(item.href, navigation)
  } catch (error) {
    return (
      <div className="rounded-xl border border-destructive bg-white p-5 text-sm text-destructive shadow-sm" role="alert">
        {error instanceof Error ? error.message : String(error)}
      </div>
    )
  }
  if (aktion.weg === null) return null
  const Icon = item.icon ? CARD_ICONS[item.icon] : null
  return (
    <div className="group relative flex flex-col rounded-xl bg-white p-5 text-neutral-900 shadow-sm transition-shadow hover:shadow-md" data-website-karte>
      {Icon && <Icon className="mb-3 h-6 w-6 text-[color:var(--site-accent-strong)]" aria-hidden="true" />}
      <h3 className={cn('text-lg leading-snug text-neutral-900', HEADING_FONT)}>{item.title}</h3>
      {item.text && <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-700">{item.text}</p>}
      <WegLink
        weg={aktion.weg}
        target={aktion.extern ? '_blank' : undefined}
        rel={aktion.extern ? 'noopener noreferrer' : undefined}
        // Der Link deckt die ganze Karte (::after), damit die Flaeche klickbar ist, nicht nur die Zeile.
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--site-accent-strong)] after:absolute after:inset-0 after:content-['']"
      >
        {item.linkLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </WegLink>
    </div>
  )
}

export function Cards({ items, navigation }: { items: CardItem[]; navigation?: WebsiteNavigation }): React.ReactElement {
  return (
    <div className="not-prose my-6 grid gap-4 md:grid-cols-3">
      {items.map((item, i) => <Karte key={i} item={item} navigation={navigation} />)}
    </div>
  )
}
