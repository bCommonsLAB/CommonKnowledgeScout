/**
 * Props-Vertrag der Detailansicht (D6b aus `detail-overlay.tsx` gezogen,
 * Inhalt 1:1). Die Typen sind die oeffentliche Oberflaeche des Moduls
 * (`DetailRenderer`, `DetailRenderProps` in `@ks/module-explorer/react`).
 */

import type React from 'react'
import type { DetailViewType } from '@ks/contracts'
import type { DocCardMeta } from '../../lib/types'

/** Was ein Renderer braucht, um eine Detailansicht zu bauen. */
export interface DetailRenderProps {
  libraryId: string
  fileId: string
  /**
   * Die Antwort von `/doc-meta`, `docMetaJson` bereits mit der aktiven Locale
   * veredelt — `null`, solange sie laedt oder wenn es keine gab. Der Renderer
   * mappt sie selbst in seine Form; die Galerie kennt die Formen nicht.
   */
  docMeta: Record<string, unknown> | null
  /** `true`, sobald der Doc-Meta-Abruf abgeschlossen ist — auch ohne Ergebnis. */
  isDocMetaReady: boolean
  fallbackLocale?: string
}

/**
 * Eine Detailansicht als Komponente. Bewusst keine blosse Funktion: Renderer
 * duerfen Hooks nutzen (die Buch- und Session-Ansicht memoisieren ihr
 * Mapping, weil `initialData` dort in einem Effekt haengt).
 */
export type DetailRenderer = React.ComponentType<DetailRenderProps>

export interface DetailOverlayProps {
  open: boolean
  onClose: () => void
  libraryId: string
  fileId: string
  /** Typ der Detailansicht — Werteliste aus der zentralen Registry */
  viewType: DetailViewType
  /**
   * Welche Ansicht zu welchem Typ gehoert. Kommt vom Montagepunkt (M4g): Die
   * Galerie kennt die zehn Detail-Komponenten der App nicht mehr. Der
   * `Record` haelt die Typgrenze — ein neuer `detailViewType` ist dort ein
   * Typfehler, bis er eine Ansicht hat.
   */
  detailRenderers: Record<DetailViewType, DetailRenderer>
  /** D7: Seite, an der die Ansicht aufgeht (Zitatmarke → Beleg → Seite); ohne Angabe am Anfang. */
  page?: number
  title?: string
  /** Optional: Dokument-Metadaten für den SwitchToStoryModeButton */
  doc?: DocCardMeta
  /**
   * Gibt es einen Story-Modus, in den der Knopf wechseln kann? Die App reicht
   * immer einen Story-Slot herein, das Embed nur in der Story-Ansicht (D6b).
   * Ohne Slot fuehrte „In Story Mode ansehen" ins Leere.
   */
  storyModusVerfuegbar: boolean
  /** Optional: Aktueller Mode für den SwitchToStoryModeButton */
  currentMode?: 'gallery' | 'story'
  /** Optional: Ref für Flag, um zu verhindern, dass selectedDoc während des Wechsels verwendet wird */
  isSwitchingRef?: React.MutableRefObject<boolean>
  /** Optional: Fallback-Locale aus library.config.translations.fallbackLocale */
  fallbackLocale?: string
  /** Vorheriges Dokument (fuer Pfeil-Navigation links). */
  prevDoc?: DocCardMeta | null
  /** Naechstes Dokument (fuer Pfeil-Navigation rechts). */
  nextDoc?: DocCardMeta | null
  /** Callback: navigiere zu einem benachbarten Dokument. */
  onNavigateToDoc?: (doc: DocCardMeta) => void
  /**
   * Vollstaendige Geschwister-Liste (in der Reihenfolge der Galerie).
   * Wird vom Tinder-Sequencer genutzt, um nach `not_important` / `favorite`
   * einzuschraenken und unbewertete Quellen einzeln durchzugehen.
   */
  siblingDocs?: DocCardMeta[]
  /**
   * Stern togglen (optimistischer Patch + POST), wie in der Galerie.
   */
  onToggleFavorite?: (fileId: string) => void | Promise<void>
}
