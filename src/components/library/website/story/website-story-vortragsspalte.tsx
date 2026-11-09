'use client'

/**
 * Darstellung `cards=column` (Owner 09.11.2026, Figma S2-A): alle zitierten
 * Dokumente als Bildkarten nach erster Zitatnummer, ohne Obergrenze. Ab `lg`
 * steht die Spalte rechts neben der Antwort (so lang wie noetig, `self-start`,
 * nicht sticky); darunter liegt sie als Raster unter der Antwort (Telefon).
 * Unter den Karten der dezente Verweis „weitere …" ins Belege-Blatt mit den
 * Textstellen. Mit `raster` dient der Baustein auch als Rest-Raster der
 * Absatzvariante (Dokumente, die keinem Absatz zugeordnet wurden).
 */

import type { KartenEintrag } from '@/lib/website/story-karten'
import { WebsiteStoryVortragskarte } from './website-story-vortragskarte'

export interface WebsiteStoryVortragsspalteProps {
  eintraege: KartenEintrag[]
  libraryId: string
  /** Titel ueber den Karten („Genannte Vortraege"); leer = kein Titel. */
  titel?: string
  /** Verweis unter den Karten („weitere Vortraege mit Textstellen"); ohne `onWeitere` kein Verweis. */
  weitereLabel?: string
  onWeitere?: () => void
  onOpen: (slug: string) => void
  /** Raster statt Spalte (Rest-Raster der Absatzvariante, unter der Antwort). */
  raster?: boolean
}

export function WebsiteStoryVortragsspalte({ eintraege, libraryId, titel, weitereLabel, onWeitere, onOpen, raster = false }: WebsiteStoryVortragsspalteProps) {
  if (eintraege.length === 0) return null
  return (
    <aside className="not-prose self-start" data-story-karten={raster ? 'raster' : 'column'}>
      {titel && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{titel}</p>}
      <div className={raster ? 'grid gap-4 sm:grid-cols-2 md:grid-cols-3' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-1'}>
        {eintraege.map((e) => (
          <WebsiteStoryVortragskarte key={e.nummer} eintrag={e} libraryId={libraryId} onOpen={onOpen} />
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
