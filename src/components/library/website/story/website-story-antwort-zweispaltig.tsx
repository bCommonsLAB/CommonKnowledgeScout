'use client'

/**
 * Darstellung `cards=inline` (Owner 09.11.2026, Figma S2-B): die Antwort
 * zweispaltig je Absatz. Der rohe Markdown wird in Bloecke zerlegt
 * (Leerzeilen-Absaetze, Listenpunkte, `story-karten.ts`); ein Block mit einer
 * noch nicht gezeigten Dokumentnummer wird zur Zeile — links die Bildkarte des
 * zitierten Dokuments (ein Drittel), rechts der Absatz (`AntwortText` mit
 * denselben Belegen, Marken wie im Text). Einleitung, Schluss und Bloecke
 * ohne neue Nummer stehen in voller Breite. Dokumente, die keinem Block
 * zugeordnet wurden, folgen als Raster darunter. Telefon (unter `sm`): Karte
 * ueber dem Absatz. Setzt voraus, dass der Regelsatz der Sektion je Dokument
 * einen Absatz schreibt — sonst ist es die heutige Antwort mit Rest-Raster.
 */

import { useMemo } from 'react'
import type { DocCardMeta } from '@ks/contracts'
import { AntwortText, type Nachricht } from '@ks/module-story/react'
import { antwortBloecke, bloeckeMitNummern, type KartenEintrag } from '@/lib/website/story-karten'
import { WebsiteStoryVortragskarte } from './website-story-vortragskarte'
import { WebsiteStoryVortragsspalte } from './website-story-vortragsspalte'

export interface WebsiteStoryAntwortZweispaltigProps {
  antwort: Nachricht
  markenVerborgen: boolean
  eintraege: KartenEintrag[]
  libraryId: string
  onOpen: (doc: DocCardMeta) => void
  /** Titel des Rest-Rasters; Verweis ins Blatt darunter. */
  restTitel: string
  weitereLabel: string
  onWeitere: () => void
}

const PROSE = 'prose prose-sm max-w-none dark:prose-invert'

export function WebsiteStoryAntwortZweispaltig(p: WebsiteStoryAntwortZweispaltigProps) {
  const belege = useMemo(() => p.antwort.belege ?? [], [p.antwort.belege])
  const bloecke = useMemo(() => bloeckeMitNummern(antwortBloecke(p.antwort.text), belege), [p.antwort.text, belege])
  const jeNummer = useMemo(() => new Map(p.eintraege.map((e) => [e.nummer, e])), [p.eintraege])
  const zugeordnet = new Set(bloecke.map((b) => b.nummer).filter((n): n is number => n !== null && jeNummer.has(n)))
  const rest = p.eintraege.filter((e) => !zugeordnet.has(e.nummer))

  return (
    <div className="space-y-4" data-story-karten="inline">
      {bloecke.map((block, i) => {
        const eintrag = block.nummer !== null ? jeNummer.get(block.nummer) : undefined
        if (!eintrag) {
          return <AntwortText key={i} text={block.text} belege={belege} markenVerborgen={p.markenVerborgen} className={PROSE} />
        }
        return (
          <div key={i} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-start" data-story-absatz-zeile={eintrag.nummer}>
            <WebsiteStoryVortragskarte eintrag={eintrag} libraryId={p.libraryId} onOpen={p.onOpen} />
            <AntwortText text={block.text} belege={belege} markenVerborgen={p.markenVerborgen} className={PROSE} />
          </div>
        )
      })}
      <WebsiteStoryVortragsspalte raster eintraege={rest} libraryId={p.libraryId} titel={p.restTitel} onOpen={p.onOpen} />
      <button type="button" onClick={p.onWeitere} className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline" data-story-karten-weitere>
        {p.weitereLabel} →
      </button>
    </div>
  )
}
