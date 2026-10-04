'use client'

import React from 'react'
import { AnsichtsZeile, Input, useAnsichtErklaerung, useScrollVisibility } from '@ks/ui'
import { Search } from 'lucide-react'
import { ViewModeToggle } from './view-mode-toggle'
import { GalleryCardDensityToggle } from './gallery-card-density-toggle'
import type { GalleryCardDensity } from '../lib/gallery-card-density'

export type ViewMode = 'grid' | 'table' | 'graph'

export interface GalleryStickyHeaderProps {
  /** Kopf der Seite (D10b): Titel der Library, in Galerie und Story gleich. */
  headline: string
  /** Zweizeiler der Library unter dem Titel; fehlt er, faellt die Zeile weg. */
  description?: string
  /** Ansichtszeile: Name der Ansicht und ihre Erklaerung (Konfig `gallery.headline/description`, sonst Uebersetzung). */
  ansicht: {
    name: React.ReactNode
    erklaerung: { titel: string; text: string }
    labels: { oeffnen: string; schliessen: string }
  }
  searchPlaceholder: string
  queryValue: string
  onChangeQuery: (v: string) => void
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  /** Nur bei Grid: Karten-Raster kompakt vs. komfortabel */
  cardDensity?: GalleryCardDensity
  onCardDensityChange?: (density: GalleryCardDensity) => void
  /** Graph-Modus als dritte Ansicht anbieten (nur wenn pro Library aktiviert). */
  showGraph?: boolean
  /** Optionale Aktionen rechts in der Toolbar (z.B. „Inhalte erfassen"). */
  actions?: React.ReactNode
  /**
   * Verifikations-Abzeichen neben der Ueberschrift. Als Slot (M4g): Es liest
   * die Rolle und die Verifikations-API der App — die Galerie zeigt nur, was
   * ihr der Montagepunkt gibt. Kein Slot, kein Abzeichen (Embed).
   */
  verifikationsAbzeichen?: React.ReactNode
}

/**
 * Sticky-Header der Gallery-Ansicht (Figma „Schritt 7", D10b):
 * - Kopf der Seite: Titel und Zweizeiler der Library (beim Scrollen ausgeblendet)
 * - Ansichtszeile: „Inhalte erkunden" mit ⓘ, rechts Suche, Ansichtswahl, Aktionen
 * - Erklaerung der Ansicht darunter, beim ersten Besuch auf (useAnsichtErklaerung)
 */
export function GalleryStickyHeader(props: GalleryStickyHeaderProps) {
  const {
    headline,
    description,
    ansicht,
    searchPlaceholder,
    queryValue,
    onChangeQuery,
    viewMode = 'grid',
    onViewModeChange,
    cardDensity = 'comfortable',
    onCardDensityChange,
    showGraph = false,
    actions,
    verifikationsAbzeichen,
  } = props

  // Verwende gemeinsamen Scroll-Visibility-Hook (wie TopNav)
  // isVisible === false bedeutet: Kopf der Seite ausblenden (condensed)
  const isVisible = useScrollVisibility()
  const isCondensed = !isVisible
  const erklaerung = useAnsichtErklaerung('galerie')

  const werkzeuge = (
    <>
      <div className="relative min-w-[12rem] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={queryValue}
          onChange={(e) => onChangeQuery(e.target.value)}
          className="pl-10 text-sm sm:text-base"
        />
      </div>
      {/* Karten-Dichte vor Galerie/Tabelle (Dichte nur im Grid); Bezeichnungen nur in Tooltips */}
      {onViewModeChange && (
        <div className="flex shrink-0 items-center gap-2">
          {viewMode === 'grid' && onCardDensityChange && (
            <GalleryCardDensityToggle cardDensity={cardDensity} onCardDensityChange={onCardDensityChange} />
          )}
          <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} showGraph={showGraph} />
        </div>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </>
  )

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isCondensed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-96 opacity-100'
        }`}
        style={{
          willChange: isCondensed ? 'max-height, opacity' : 'auto',
          // Verhindere Layout-Shifts während Transition (robuster für ältere Geräte)
          contain: 'layout style paint',
        }}
      >
        <div className="py-4 space-y-1" data-seitenkopf>
          <div className="flex items-center gap-2 flex-wrap">
            {/* D12v: ohne Titel (Erkunden-Seite zeigt den Namen schon oben) bleiben Plakette und Zweizeiler. */}
            {headline ? <h2 className="text-2xl font-bold leading-tight">{headline}</h2> : null}
            {/* Verifikations-Status beim Öffnen — nur für Mitglieder sichtbar (A2); kommt vom Montagepunkt. */}
            {verifikationsAbzeichen}
          </div>
          {description ? <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
      </div>

      <AnsichtsZeile
        className="py-2 lg:py-1"
        name={ansicht.name}
        erklaerung={{ ...ansicht.erklaerung, offen: erklaerung.offen, onToggle: erklaerung.toggle, labels: ansicht.labels }}
        werkzeuge={werkzeuge}
        eingeklappt={isCondensed}
      />
    </div>
  )
}
