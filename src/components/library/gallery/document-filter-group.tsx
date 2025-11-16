'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/hooks'
import { createDocTitleMap } from '@/utils/gallery/doc-title-map'

export interface DocumentFilterGroupProps {
  /** Array von fileIds, die gefiltert werden sollen */
  fileIds: string[]
  /** Dokumentenliste für Titel-Lookup */
  docs: Array<{ fileId?: string; id?: string; title?: string; shortTitle?: string }>
  /** Callback wenn Filter zurückgesetzt wird */
  onReset: () => void
  /** Callback wenn einzelner Filter entfernt wird */
  onRemove: (fileId: string) => void
}

/**
 * Komponente zur Anzeige und Verwaltung von fileId-Filtern
 * Zeigt ausgewählte Dokumente mit Möglichkeit zum Entfernen einzelner Filter
 */
export function DocumentFilterGroup({ fileIds, docs, onReset, onRemove }: DocumentFilterGroupProps) {
  const { t } = useTranslation()
  const docTitleMap = createDocTitleMap(docs)

  if (fileIds.length === 0) {
    return null
  }

  return (
    <div className="border rounded p-2 bg-gradient-to-br from-blue-50/30 to-cyan-50/30 dark:from-blue-950/10 dark:to-cyan-950/10">
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <div className="text-sm font-medium truncate flex-1 min-w-0">{t('gallery.document')}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-6 px-2 text-xs shrink-0"
        >
          {t('gallery.reset')}
        </Button>
      </div>
      <div className="space-y-1">
        {fileIds.map((fileId) => {
          const docTitle = docTitleMap.get(fileId) || fileId
          return (
            <div
              key={fileId}
              className="flex items-center justify-between rounded px-2 py-1 bg-primary/10 text-sm"
            >
              <span title={docTitle} className="truncate flex-1 min-w-0 pr-2">{docTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(fileId)}
                className="h-5 w-5 p-0 shrink-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

