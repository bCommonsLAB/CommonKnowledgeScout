import { describe, it, expect } from 'vitest'
import {
  buildEditableRows,
  toggleRow,
  moveRow,
  rowsToConfig,
  type AvailableWizard,
} from '@/lib/creation/capture-wizards-edit'
import type { CaptureWizardsConfig } from '@/types/library'

const available: AvailableWizard[] = [
  { flowId: 'event', label: 'Event' },
  { flowId: 'book', label: 'Buch' },
  { flowId: 'testimonial', label: 'Erfahrungsbericht' },
]

describe('buildEditableRows', () => {
  it('ohne Config: alle verfuegbaren Wizards deaktiviert, in Reihenfolge', () => {
    const rows = buildEditableRows(available, undefined)
    expect(rows.map((r) => r.flowId)).toEqual(['event', 'book', 'testimonial'])
    expect(rows.every((r) => !r.enabled)).toBe(true)
  })

  it('mit Config: Config-Reihenfolge/Flags zuerst, Rest deaktiviert angehaengt', () => {
    const config: CaptureWizardsConfig = {
      wizards: [
        { flowId: 'book', enabled: true },
        { flowId: 'event', enabled: false, label: 'Konferenz' },
      ],
    }
    const rows = buildEditableRows(available, config)
    expect(rows.map((r) => r.flowId)).toEqual(['book', 'event', 'testimonial'])
    expect(rows[0].enabled).toBe(true)
    expect(rows[1].label).toBe('Konferenz') // Label-Override
    expect(rows[2].enabled).toBe(false) // angehaengt
  })
})

describe('toggleRow', () => {
  it('schaltet genau eine Zeile um', () => {
    const rows = buildEditableRows(available, undefined)
    const next = toggleRow(rows, 'book')
    expect(next.find((r) => r.flowId === 'book')?.enabled).toBe(true)
    expect(next.find((r) => r.flowId === 'event')?.enabled).toBe(false)
  })
})

describe('moveRow', () => {
  it('verschiebt hoch/runter; an den Raendern unveraendert', () => {
    const rows = buildEditableRows(available, undefined)
    expect(moveRow(rows, 'book', -1).map((r) => r.flowId)).toEqual(['book', 'event', 'testimonial'])
    expect(moveRow(rows, 'event', -1).map((r) => r.flowId)).toEqual(['event', 'book', 'testimonial'])
    expect(moveRow(rows, 'testimonial', 1).map((r) => r.flowId)).toEqual(['event', 'book', 'testimonial'])
  })
})

describe('rowsToConfig', () => {
  it('serialisiert Zeilen inkl. enabled-Flags', () => {
    const rows = toggleRow(buildEditableRows(available, undefined), 'book')
    const cfg = rowsToConfig(rows, undefined)
    expect(cfg.wizards.find((w) => w.flowId === 'book')?.enabled).toBe(true)
    expect(cfg.defaultFlowId).toBeUndefined()
  })

  it('uebernimmt defaultFlowId nur fuer aktivierte Zeilen', () => {
    const rows = toggleRow(buildEditableRows(available, undefined), 'book')
    expect(rowsToConfig(rows, 'book').defaultFlowId).toBe('book')
    // event ist deaktiviert -> kein Default
    expect(rowsToConfig(rows, 'event').defaultFlowId).toBeUndefined()
  })
})
