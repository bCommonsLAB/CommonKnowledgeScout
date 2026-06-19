"use client"

import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import type { CaptureWizardsConfig } from "@/types/library"
import {
  buildEditableRows,
  toggleRow,
  moveRow,
  rowsToConfig,
  type AvailableWizard,
} from "@/lib/creation/capture-wizards-edit"
import { getLibraryCreationConfig } from "@/lib/templates/library-creation-config"
import { STANDARD_CAPTURE_FLOW_ID } from "@/lib/creation/wizard-flow-entity"

interface CaptureWizardsEditorProps {
  libraryId: string | undefined
  value: CaptureWizardsConfig | undefined
  onChange: (value: CaptureWizardsConfig | undefined) => void
}

/**
 * Owner-Editor fuer „Inhalte erfassen"-Kuratierung (Plan 2 · W-C-2).
 * Laedt die verfuegbaren Wizards der Library und laesst An/Aus, Reihenfolge und
 * Default setzen. Die Logik liegt in `capture-wizards-edit.ts` (getestet);
 * diese Komponente ist nur die duenne UI. Speichern uebernimmt das Library-Form.
 */
export function CaptureWizardsEditor({ libraryId, value, onChange }: CaptureWizardsEditorProps) {
  const [available, setAvailable] = React.useState<AvailableWizard[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!libraryId) return
      // Unkuratierte Liste (kein captureWizards) = alle waehlbaren Wizards.
      const types = await getLibraryCreationConfig(libraryId)
      if (cancelled) return
      const rows: AvailableWizard[] = [
        { flowId: STANDARD_CAPTURE_FLOW_ID, label: "Inhalt erfassen (Standard)" },
        ...types.map((t) => ({ flowId: t.id, label: t.label })),
      ]
      setAvailable(rows)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [libraryId])

  const rows = React.useMemo(() => buildEditableRows(available, value), [available, value])
  const defaultFlowId = value?.defaultFlowId

  const emit = React.useCallback(
    (nextRows: ReturnType<typeof buildEditableRows>, nextDefault: string | undefined) => {
      const hasEnabled = nextRows.some((r) => r.enabled)
      onChange(hasEnabled ? rowsToConfig(nextRows, nextDefault) : undefined)
    },
    [onChange],
  )

  if (!libraryId) {
    return <p className="text-sm text-muted-foreground">Bitte zuerst die Bibliothek speichern.</p>
  }
  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">Wizards werden geladen…</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Aktivierte Wizards erscheinen unter &quot;Inhalte erfassen&quot; — in dieser Reihenfolge. Ohne
        aktivierte Auswahl gilt das Bestandsverhalten.
      </p>
      <ul className="divide-y rounded-md border">
        {rows.map((row, idx) => (
          <li key={row.flowId} className="flex items-center gap-2 px-3 py-2">
            <Switch
              checked={row.enabled}
              onCheckedChange={() => emit(toggleRow(rows, row.flowId), defaultFlowId)}
              aria-label={`${row.label} aktivieren`}
            />
            <span className="flex-1 truncate text-sm">{row.label}</span>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="radio"
                name="capture-default"
                checked={defaultFlowId === row.flowId}
                disabled={!row.enabled}
                onChange={() => emit(rows, row.flowId)}
              />
              Default
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={idx === 0}
              onClick={() => emit(moveRow(rows, row.flowId, -1), defaultFlowId)}
              aria-label="Nach oben"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={idx === rows.length - 1}
              onClick={() => emit(moveRow(rows, row.flowId, 1), defaultFlowId)}
              aria-label="Nach unten"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default CaptureWizardsEditor
