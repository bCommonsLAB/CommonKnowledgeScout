'use client'

/**
 * Platzhalter-Karten fuer noch nicht geladene Dokumente der Galerie.
 *
 * Die Galerie laedt seitenweise nach. Bis 2026-09-15 endete die Liste hinter
 * der letzten geladenen Karte mit einem kleinen Lade-Hinweis; der Rollbalken
 * kannte die wahre Laenge der Sammlung nicht, und beim Nachladen wuchs die
 * Liste ruckartig. Jetzt stehen hinter den geladenen Karten so viele
 * Platzhalter, wie die Sammlung noch Dokumente hat (bis zu einer Obergrenze).
 * Der Nutzer scrollt fluessig ueber die volle Laenge; sobald eine Seite
 * eintrifft, ruecken echte Karten an die Stelle der Platzhalter.
 */

import React from 'react'
import { cn } from '@ks/util'
import {
  itemsGridClassForDensity,
  type GalleryCardDensity,
} from '../lib/gallery-card-density'

/**
 * Obergrenze fuer Platzhalter im DOM. Bei sehr grossen Sammlungen waere die
 * wahre Restzahl zu viel fuer die Seite; die Liste bleibt dann am Ende kuerzer
 * als die Sammlung und waechst mit jeder Seite nach.
 */
export const MAX_PLACEHOLDER_CARDS = 300

export interface PlaceholderCardCountInput {
  /** Gesamtzahl der Dokumente laut Server (undefined = unbekannt). */
  totalCount: number | undefined
  /** Anzahl bereits geladener Karten. */
  loadedCount: number
  /** Ob der Server noch weitere Seiten hat. */
  hasMore: boolean
}

/**
 * Wie viele Platzhalter unter den geladenen Karten stehen sollen.
 * 0, wenn nichts mehr kommt oder die Gesamtzahl nicht bekannt ist.
 */
export function placeholderCardCount({ totalCount, loadedCount, hasMore }: PlaceholderCardCountInput): number {
  if (!hasMore) return 0
  if (typeof totalCount !== 'number' || !Number.isFinite(totalCount)) return 0
  const remaining = totalCount - loadedCount
  if (remaining <= 0) return 0
  return Math.min(remaining, MAX_PLACEHOLDER_CARDS)
}

/**
 * Seitenverhaeltnis des Platzhalters je Kartentyp — spiegelt die
 * Karten in `./document-card/`, damit die Platzhalter dieselbe Hoehe haben
 * wie die echten Karten, die sie ersetzen.
 */
export function placeholderShapeClass(detailViewType: string | undefined): string {
  switch (detailViewType) {
    case 'climateAction':
    case 'refurbedDevice':
      return 'aspect-[4/3] rounded-lg'
    case 'session':
      return 'aspect-[16/9] rounded-lg'
    case 'divaTexture':
      return 'aspect-square rounded-lg'
    default:
      // Standard-Karte (Buecher, Dokumente): Karte mit Kopf und Textzeilen,
      // wie StandardCard fuer alle uebrigen Typen.
      return 'min-h-[13rem] rounded-xl'
  }
}

export interface ItemsGridPlaceholdersProps {
  count: number
  cardDensity: GalleryCardDensity
  libraryDetailViewType?: string
}

/**
 * Raster aus Platzhalter-Karten. Eigener `@container`, damit die Spalten
 * genauso brechen wie im Raster der echten Karten ({@link ItemsGrid}).
 */
export function ItemsGridPlaceholders({ count, cardDensity, libraryDetailViewType }: ItemsGridPlaceholdersProps) {
  if (count <= 0) return null
  const shape = placeholderShapeClass(libraryDetailViewType)
  return (
    // [overflow-anchor:none]: Der Browser darf die Ansicht NICHT an einem
    // Platzhalter verankern. Sonst schiebt er sie beim Einruecken echter
    // Karten (oben) um deren Hoehe nach unten, der Block bleibt im Bild, die
    // naechste Seite laedt — und die Ansicht rutscht bis ans Ende durch.
    // Ohne Anker bleibt scrollTop stehen, und die Karten erscheinen genau
    // dort, wo eben noch die Platzhalter standen.
    <div
      className='@container mt-4 [overflow-anchor:none]'
      aria-busy='true'
      aria-label='Weitere Dokumente werden geladen'
      data-testid='items-grid-placeholders'
    >
      <div className={itemsGridClassForDensity(cardDensity)}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={cn('animate-pulse bg-muted shadow-sm', shape)}
            aria-hidden='true'
          />
        ))}
      </div>
    </div>
  )
}
