'use client'

/**
 * Darstellung `cards=column` (Owner 09.11.2026, Figma S2-A): alle zitierten
 * Dokumente als Bildkarten nach erster Zitatnummer, ohne Obergrenze. Ab `lg`
 * steht die Spalte rechts neben der Antwort (so lang wie noetig, `self-start`,
 * nicht sticky); darunter liegt sie unter der Antwort — auf dem Tablet als
 * zweispaltiges Raster, auf dem Telefon als waagrechte Reihe zum Wischen
 * (Owner 24.11.2026: viele Karten untereinander machten die Antwort endlos).
 * Unter den Karten der dezente Verweis „weitere …" ins Belege-Blatt mit den
 * Textstellen. Mit `raster` dient der Baustein auch als Rest-Raster der
 * Absatzvariante (Dokumente, die keinem Absatz zugeordnet wurden).
 */

import type { DocCardMeta } from '@ks/contracts'
import type { KartenEintrag } from '..'
import { WebsiteStoryVortragskarte } from './website-story-vortragskarte'

export interface WebsiteStoryVortragsspalteProps {
  eintraege: KartenEintrag[]
  libraryId: string
  /** Titel ueber den Karten („Genannte Vortraege"); leer = kein Titel. */
  titel?: string
  /** Verweis unter den Karten („weitere Vortraege mit Textstellen"); ohne `onWeitere` kein Verweis. */
  weitereLabel?: string
  onWeitere?: () => void
  onOpen: (doc: DocCardMeta) => void
  /** Raster statt Spalte (Rest-Raster der Absatzvariante, unter der Antwort). */
  raster?: boolean
}

/**
 * Telefon: eine Reihe zum Wischen, die naechste Karte schaut hervor. Der Rand oben und links laesst
 * der Zitatmarke Platz, die ueber die Ecke der Karte ragt (die Reihe schneidet sonst ab). Ab `sm`
 * das Raster, ab `lg` die Spalte.
 */
const REIHE = 'flex snap-x snap-mandatory scroll-pl-2 gap-4 overflow-x-auto pb-2 pl-2 pt-2 [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-0 lg:grid-cols-1'
const KARTE = 'w-[84%] shrink-0 snap-start sm:w-auto'

export function WebsiteStoryVortragsspalte({ eintraege, libraryId, titel, weitereLabel, onWeitere, onOpen, raster = false }: WebsiteStoryVortragsspalteProps) {
  if (eintraege.length === 0) return null
  return (
    <aside className="not-prose self-start" data-story-karten={raster ? 'raster' : 'column'}>
      {titel && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{titel}</p>}
      <div className={raster ? 'grid gap-4 sm:grid-cols-2 md:grid-cols-3' : REIHE} data-story-karten-reihe={raster ? undefined : eintraege.length}>
        {eintraege.map((e) => (
          <WebsiteStoryVortragskarte key={e.nummer} eintrag={e} libraryId={libraryId} onOpen={onOpen} className={raster ? undefined : eintraege.length > 1 ? KARTE : 'w-full shrink-0 sm:w-auto'} />
        ))}
      </div>
      {onWeitere && weitereLabel && (
        <button type="button" onClick={onWeitere} className="mt-3 text-xs text-neutral-500 hover:text-neutral-800 hover:underline" data-story-karten-weitere>
          {weitereLabel} →
        </button>
      )}
    </aside>
  )
}
