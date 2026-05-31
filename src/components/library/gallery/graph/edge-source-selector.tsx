'use client'

/**
 * EdgeSourceSelector — wählt die aktive Kantenquelle des Graphen.
 *
 * Welle 2 implementiert nur Quelle B (gemeinsame Metadaten): pro konfiguriertem
 * Feld eine „Verbinde nach …"-Option plus ein Hub/Projektion-Umschalter.
 * Quelle A (Beziehungen) und C (Ähnlichkeit) erscheinen deaktiviert mit
 * „später"-Hinweis (kein Silent Fallback — die Optionen sind explizit sichtbar).
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
}

export function EdgeSourceSelector({ selection, onChange, sharedMetaFields, fieldLabels }: EdgeSourceSelectorProps) {
  const { t } = useTranslation()

  const currentMode = selection.kind === 'sharedMeta' ? selection.mode : 'projection'
  const currentValue =
    selection.kind === 'sharedMeta' ? `sharedMeta:${selection.field}` : selection.kind

  const handleSelect = (value: string) => {
    if (value.startsWith('sharedMeta:')) {
      onChange({ kind: 'sharedMeta', field: value.slice('sharedMeta:'.length), mode: currentMode })
      return
    }
    // relations/similarity sind in Welle 2 deaktiviert — ignorieren statt still
    // umzubiegen.
    console.warn('[EdgeSourceSelector] Kantenquelle in Welle 2 nicht verfügbar:', value)
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
          <SelectItem value="relations" disabled>
            {t('gallery.graph.sourceRelations')} · {t('gallery.graph.comingSoon')}
          </SelectItem>
          <SelectItem value="similarity" disabled>
            {t('gallery.graph.sourceSimilarity')} · {t('gallery.graph.comingSoon')}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
