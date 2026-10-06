"use client"

/**
 * Ob die gewaehlte Vorlage ein bestimmtes Frontmatter-Feld fuehrt (P6).
 *
 * Die Option „Slides als Tabelle fuehren" darf nur erscheinen, wenn die
 * Vorlage ein Feld `slides` hat. Die Vorlagenliste kennt nur Namen, deshalb
 * laedt der Hook den Inhalt ueber den Template-Client und prueft ihn mit der
 * Regel aus `src/lib/templates/template-field-check.ts` (dieselbe, mit der
 * die Pipeline das Feld entfernt). `null` = noch nicht bekannt (laedt oder
 * Ladefehler, der als Warnung protokolliert ist) — dann bleibt die Option
 * ausgeblendet, statt einen Wert zu raten.
 */

import * as React from 'react'
import { loadTemplate } from '@/lib/templates/template-service-client'
import { templateHasFrontmatterField } from '@/lib/templates/template-field-check'
import { FileLogger } from '@/lib/debug/logger'

export function useTemplateHasField(args: {
  libraryId: string
  templateName: string
  field: string
  enabled: boolean
}): boolean | null {
  const { libraryId, templateName, field, enabled } = args
  const [result, setResult] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    if (!enabled || !libraryId || !templateName) {
      setResult(null)
      return
    }
    let cancelled = false
    setResult(null)
    loadTemplate({ libraryId, preferredTemplateName: templateName })
      .then(({ templateContent }) => {
        if (!cancelled) setResult(templateHasFrontmatterField(templateContent, field))
      })
      .catch((err: unknown) => {
        FileLogger.warn('pipeline-sheet', 'Vorlage fuer Feldpruefung nicht ladbar — Option bleibt ausgeblendet', {
          templateName, field, error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setResult(null)
      })
    return () => {
      cancelled = true
    }
  }, [libraryId, templateName, field, enabled])

  return result
}
