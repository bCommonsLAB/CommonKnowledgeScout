'use client'

/**
 * EdgeSourceSelector — wählt die aktive Kantenquelle des Graphen.
 *
 * Quelle B (gemeinsame Metadaten): pro konfiguriertem Feld eine
 * „Verbinde nach …"-Option plus ein Hub/Projektion-Umschalter.
 * Quelle C (Ähnlichkeit, Welle 3): aktivierbar via `similarityEnabled`
 * (aus `edgeSources.similarity.enabled`). Quelle A (Beziehungen) erscheint
 * weiterhin deaktiviert mit „später"-Hinweis (kein Silent Fallback — die
 * Optionen sind explizit sichtbar).
 */

import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n/hooks'
import type { EdgeSourceSelection } from './graph-types'

interface EdgeSourceSelectorProps {
  selection: EdgeSourceSelection
  onChange: (s: EdgeSourceSelection) => void
  /** Felder aus `edgeSources.sharedMeta.fields`. */
  sharedMetaFields: string[]
  /** Optionale Anzeigenamen je Feld (aus Facetten-Labels). */
  fieldLabels?: Record<string, string>
  /** Quelle C (Ähnlichkeit) auswählbar, wenn `edgeSources.similarity.enabled`. */
  similarityEnabled?: boolean
}

export function EdgeSourceSelector({ selection, onChange, sharedMetaFields, fieldLabels, similarityEnabled }: EdgeSourceSelectorProps) {
  const { t } = useTranslation()

  const currentMode = selection.kind === 'sharedMeta' ? selection.mode : 'projection'
  const currentValue =
    selection.kind === 'sharedMeta' ? `sharedMeta:${selection.field}` : selection.kind

  const handleSelect = (value: string) => {
    if (value.startsWith('sharedMeta:')) {
      onChange({ kind: 'sharedMeta', field: value.slice('sharedMeta:'.length), mode: currentMode })
      return
    }
    if (value === 'similarity') {
      onChange({ kind: 'similarity' })
      return
    }
    // relations ist noch nicht verfügbar (Welle 4) — ignorieren statt still
    // umzubiegen.
    console.warn('[EdgeSourceSelector] Kantenquelle nicht verfügbar:', value)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('gallery.graph.connectBy')}</span>
      <Select value={currentValue} onValueChange={handleSelect}>
        <SelectTrigger className="h-8 w-[14rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{t('settings.chatForm.graphEdgeSourceSharedMeta')}</SelectLabel>
            {sharedMetaFields.map((f) => (
              <SelectItem key={f} value={`sharedMeta:${f}`}>{fieldLabels?.[f] || f}</SelectItem>
            ))}
          </SelectGroup>
          <SelectItem value="similarity" disabled={!similarityEnabled}>
            {t('gallery.graph.sourceSimilarity')}
            {!similarityEnabled && ` · ${t('gallery.graph.comingSoon')}`}
          </SelectItem>
          <SelectItem value="relations" disabled>
            {t('gallery.graph.sourceRelations')} · {t('gallery.graph.comingSoon')}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
